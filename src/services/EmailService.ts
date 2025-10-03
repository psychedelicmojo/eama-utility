// src/services/EmailService.ts
import type { ParsedEmail, ParseResult, ParseError } from '../workers/mbox-parser.worker';

export interface LoadProgress {
  percent: number;
  emailsProcessed: number;
  bytesProcessed: number;
  currentEmail?: string;
}

export type ProgressCallback = (progress: LoadProgress) => void;
export type ErrorCallback = (error: string) => void;

export class EmailService {
  private worker: Worker | null = null;
  private onProgressCallback?: ProgressCallback;
  private onErrorCallback?: ErrorCallback;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    if (this.worker) {
      this.worker.terminate();
    }

    this.worker = new Worker(
      new URL('../workers/mbox-parser.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent) => {
      const { type, data } = e.data;

      switch (type) {
        case 'progress':
          if (this.onProgressCallback) {
            this.onProgressCallback(data as LoadProgress);
          }
          break;
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('Worker error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Worker error: ${error.message}`);
      }
    };
  }

  async parseMBOX(
    file: File,
    onProgress?: ProgressCallback,
    onError?: ErrorCallback
  ): Promise<ParseResult> {
    this.onProgressCallback = onProgress;
    this.onErrorCallback = onError;

    return new Promise<ParseResult>(async (resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      try {
        const content = await file.text();

        const completeHandler = (e: MessageEvent) => {
          const { type, data } = e.data;
          
          if (type === 'complete') {
            this.worker?.removeEventListener('message', completeHandler);
            resolve(data as ParseResult);
          } else if (type === 'error') {
            this.worker?.removeEventListener('message', completeHandler);
            reject(new Error(data.message));
          }
        };

        this.worker.addEventListener('message', completeHandler);

        this.worker.postMessage({
          command: 'parse',
          data: { content }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async parseMultipleMBOX(
    files: File[],
    onProgress?: ProgressCallback,
    onError?: ErrorCallback
  ): Promise<ParseResult> {
    const allEmails: ParsedEmail[] = [];
    const allErrors: ParseError[] = [];
    let totalBytes = 0;
    let totalParseTime = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const partProgress: ProgressCallback = (progress) => {
        if (onProgress) {
          const overallPercent = ((i / files.length) * 100) + 
                                (progress.percent / files.length);
          
          onProgress({
            ...progress,
            percent: overallPercent
          });
        }
      };

      const result = await this.parseMBOX(file, partProgress, onError);
      
      allEmails.push(...result.emails);
      allErrors.push(...result.errors);
      totalBytes += result.stats.totalBytes;
      totalParseTime += result.stats.parseTime;
    }

    return {
      emails: allEmails,
      errors: allErrors,
      stats: {
        totalEmails: allEmails.length,
        totalBytes,
        parseTime: totalParseTime,
        avgEmailSize: totalBytes / allEmails.length
      }
    };
  }

  async validateMBOXFile(file: File): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const chunk = await file.slice(0, 1024).text();
      const lines = chunk.split('\n');
      const fromLineRegex = /^From \S+/;
      
      if (!fromLineRegex.test(lines[0])) {
        return {
          valid: false,
          error: 'File does not start with a valid MBOX From_ line'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${(error as Error).message}`
      };
    }
  }

  getEmailStats(emails: ParsedEmail[]) {
    if (emails.length === 0) {
      return {
        totalCount: 0,
        averageSize: 0,
        dateRange: { earliest: null, latest: null },
        topSenders: [],
        headerTypes: {}
      };
    }

    const totalSize = emails.reduce((sum, email) => sum + email.rawSize, 0);
    const averageSize = totalSize / emails.length;

    const dates = emails
      .map(e => e.metadata.date)
      .filter(d => d !== null)
      .map(d => new Date(d!))
      .sort((a, b) => a.getTime() - b.getTime());

    const dateRange = {
      earliest: dates.length > 0 ? dates[0] : null,
      latest: dates.length > 0 ? dates[dates.length - 1] : null
    };

    const senderCounts = new Map<string, number>();
    emails.forEach(email => {
      email.metadata.from.forEach(sender => {
        senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
      });
    });

    const topSenders = Array.from(senderCounts.entries())
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const headerTypes: { [key: string]: number } = {};
    emails.forEach(email => {
      Object.keys(email.headers).forEach(header => {
        headerTypes[header] = (headerTypes[header] || 0) + 1;
      });
    });

    return {
      totalCount: emails.length,
      averageSize,
      dateRange,
      topSenders,
      headerTypes
    };
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export default EmailService;
