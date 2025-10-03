// src/workers/mbox-parser.worker.ts
// MBOX Parser Web Worker Implementation

interface ParsedEmail {
  uid: string;
  messageId: string;
  headers: Record<string, string[]>;
  body: {
    text: string;
    html: string;
    raw: string;
  };
  metadata: {
    date: string | null;
    from: string[];
    to: string[];
    cc: string[];
    subject: string;
    inReplyTo?: string;
    references: string[];
  };
  rawSize: number;
}

interface ParseResult {
  emails: ParsedEmail[];
  errors: ParseError[];
  stats: {
    totalEmails: number;
    totalBytes: number;
    parseTime: number;
    avgEmailSize: number;
  };
}

interface ParseError {
  type: 'MALFORMED_HEADER' | 'ENCODING_ERROR' | 'FROM_LINE_ERROR' | 'CRITICAL';
  message: string;
  context?: string;
  emailIndex?: number;
}

class MBOXParser {
  private readonly FROM_LINE_REGEX = /^From \S+.*$/;
  private readonly HEADER_REGEX = /^([^:\s]+):\s*(.*)$/;
  private emailCount = 0;
  private errors: ParseError[] = [];

  generateUID(): string {
    return `eama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  unescapeFromLines(text: string): string {
    return text.replace(/^>+From /gm, (match) => match.substring(1));
  }

  unfoldHeader(value: string): string {
    return value.replace(/\r?\n[ \t]+/g, ' ').trim();
  }

  normalizeEOL(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  parseAddresses(headerValue: string): string[] {
    if (!headerValue) return [];
    
    const emailRegex = /<?([\w.%+-]+@[\w.-]+\.[A-Za-z]{2,})>?/g;
    const matches: string[] = [];
    let match;
    
    while ((match = emailRegex.exec(headerValue)) !== null) {
      matches.push(match[1]);
    }
    
    return matches.length > 0 ? matches : [headerValue.trim()];
  }

  parseEmail(rawEmail: string, index: number): ParsedEmail | null {
    try {
      const normalized = this.normalizeEOL(rawEmail);
      const lines = normalized.split('\n');
      
      let headerStart = 0;
      if (this.FROM_LINE_REGEX.test(lines[0])) {
        headerStart = 1;
      }

      const headers = new Map<string, string[]>();
      let currentHeader: string | null = null;
      let currentValue: string[] = [];
      let bodyStart = headerStart;

      for (let i = headerStart; i < lines.length; i++) {
        const line = lines[i];
        
        if (line === '') {
          if (currentHeader) {
            this.addHeader(headers, currentHeader, currentValue.join('\n'));
          }
          bodyStart = i + 1;
          break;
        }

        if (/^[ \t]/.test(line)) {
          if (currentHeader) {
            currentValue.push(line);
          }
          continue;
        }

        const headerMatch = line.match(this.HEADER_REGEX);
        if (headerMatch) {
          if (currentHeader) {
            this.addHeader(headers, currentHeader, currentValue.join('\n'));
          }
          
          currentHeader = headerMatch[1];
          currentValue = [headerMatch[2]];
        }
      }

      const bodyLines = lines.slice(bodyStart);
      const rawBody = bodyLines.join('\n');
      const unescapedBody = this.unescapeFromLines(rawBody);

      const metadata = this.extractMetadata(headers);

      return {
        uid: this.generateUID(),
        messageId: this.getHeader(headers, 'Message-ID') || `<generated-${this.emailCount}@eama>`,
        headers: this.serializeHeaders(headers),
        body: {
          text: unescapedBody,
          html: this.getHeader(headers, 'Content-Type')?.includes('text/html') ? unescapedBody : '',
          raw: rawBody
        },
        metadata,
        rawSize: rawEmail.length
      };
    } catch (error) {
      this.errors.push({
        type: 'CRITICAL',
        message: `Failed to parse email ${index}: ${(error as Error).message}`,
        emailIndex: index
      });
      return null;
    }
  }

  addHeader(headers: Map<string, string[]>, name: string, value: string): void {
    const normalized = name.toLowerCase();
    const unfolded = this.unfoldHeader(value);
    
    if (!headers.has(normalized)) {
      headers.set(normalized, []);
    }
    headers.get(normalized)!.push(unfolded);
  }

  getHeader(headers: Map<string, string[]>, name: string): string | null {
    const values = headers.get(name.toLowerCase());
    return values ? values[0] : null;
  }

  serializeHeaders(headers: Map<string, string[]>): Record<string, string[]> {
    const obj: Record<string, string[]> = {};
    for (const [key, values] of headers.entries()) {
      obj[key] = values;
    }
    return obj;
  }

  extractMetadata(headers: Map<string, string[]>) {
    return {
      date: this.parseDate(this.getHeader(headers, 'Date')),
      from: this.parseAddresses(this.getHeader(headers, 'From') || ''),
      to: this.parseAddresses(this.getHeader(headers, 'To') || ''),
      cc: this.parseAddresses(this.getHeader(headers, 'Cc') || ''),
      subject: this.getHeader(headers, 'Subject') || '(No Subject)',
      inReplyTo: this.getHeader(headers, 'In-Reply-To') || undefined,
      references: this.getHeader(headers, 'References')?.split(/\s+/).filter(Boolean) || []
    };
  }

  parseDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return null;
    }
  }

  splitMBOX(content: string): string[] {
    const emails: string[] = [];
    const lines = this.normalizeEOL(content).split('\n');
    let currentEmail: string[] = [];
    let inEmail = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (this.FROM_LINE_REGEX.test(line) && (i === 0 || lines[i - 1] === '')) {
        if (currentEmail.length > 0) {
          emails.push(currentEmail.join('\n'));
        }
        currentEmail = [line];
        inEmail = true;
      } else if (inEmail) {
        currentEmail.push(line);
      }
    }

    if (currentEmail.length > 0) {
      emails.push(currentEmail.join('\n'));
    }

    return emails;
  }

  async parse(fileContent: string): Promise<ParseResult> {
    const startTime = performance.now();
    const rawEmails = this.splitMBOX(fileContent);
    const parsedEmails: ParsedEmail[] = [];
    const totalBytes = fileContent.length;
    let processedBytes = 0;

    for (let i = 0; i < rawEmails.length; i++) {
      const rawEmail = rawEmails[i];
      const parsed = this.parseEmail(rawEmail, i);
      
      if (parsed) {
        parsedEmails.push(parsed);
        this.emailCount++;
      }

      processedBytes += rawEmail.length;

      if (i % 10 === 0 || i === rawEmails.length - 1) {
        self.postMessage({
          type: 'progress',
          data: {
            percent: (processedBytes / totalBytes) * 100,
            emailsProcessed: this.emailCount,
            bytesProcessed: processedBytes,
            currentEmail: parsed?.metadata.subject
          }
        });
      }
    }

    const parseTime = performance.now() - startTime;

    return {
      emails: parsedEmails,
      errors: this.errors,
      stats: {
        totalEmails: parsedEmails.length,
        totalBytes,
        parseTime,
        avgEmailSize: totalBytes / parsedEmails.length
      }
    };
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { command, data } = e.data;

  if (command === 'parse') {
    try {
      const parser = new MBOXParser();
      const result = await parser.parse(data.content);
      
      self.postMessage({
        type: 'complete',
        data: result
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        data: {
          message: (error as Error).message,
          stack: (error as Error).stack
        }
      });
    }
  }
};

export type { ParsedEmail, ParseResult, ParseError };
