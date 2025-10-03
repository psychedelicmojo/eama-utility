import { describe, it, expect } from 'vitest';
import { MBOXParser } from '../../src/services/MBOXParser';

describe('MBOX Parser - Basic Functionality', () => {
  it('should parse a single simple email', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Test Email
Date: Mon, 1 Jan 2024 10:00:00 +0000
Message-ID: <test@example.com>

This is a test email body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].metadata.subject).toBe('Test Email');
    expect(result.emails[0].metadata.from).toContain('sender@example.com');
    expect(result.emails[0].metadata.to).toContain('recipient@example.com');
  });

  it('should parse multiple emails', () => {
    const parser = new MBOXParser();
    const mboxContent = `From alice@example.com Mon Jan 01 10:00:00 2024
From: alice@example.com
To: bob@example.com
Subject: First Email
Message-ID: <1@example.com>

First body.

From bob@example.com Mon Jan 01 11:00:00 2024
From: bob@example.com
To: alice@example.com
Subject: Second Email
Message-ID: <2@example.com>

Second body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails).toHaveLength(2);
    expect(result.emails[0].metadata.subject).toBe('First Email');
    expect(result.emails[1].metadata.subject).toBe('Second Email');
  });

  it('should handle empty subject', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Message-ID: <test@example.com>

Body without subject.`;

    const result = parser.parse(mboxContent);
    
    expect(result.emails[0].metadata.subject).toBe('(No Subject)');
  });
});

describe('MBOX Parser - From Line Escaping (F-IN.103)', () => {
  it('should unescape single-escaped From lines', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: From Escaping Test
Message-ID: <test@example.com>

>From this line should be unescaped
Normal text line
>From another escaped line`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].body.text).toContain('From this line should be unescaped');
    expect(result.emails[0].body.text).toContain('From another escaped line');
    expect(result.emails[0].body.text).not.toContain('>From');
  });

  it('should handle multi-level From escaping', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Multi-level
Message-ID: <test@example.com>

>From single escape
>>From double escape
>>>From triple escape`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].body.text).toContain('From single escape');
    expect(result.emails[0].body.text).toContain('>From double escape');
    expect(result.emails[0].body.text).toContain('>>From triple escape');
  });

  it('should not unescape From in middle of line', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Test
Message-ID: <test@example.com>

This is From in the middle
Not at start >From here`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].body.text).toContain('This is From in the middle');
    expect(result.emails[0].body.text).toContain('Not at start >From here');
  });
});

describe('MBOX Parser - Header Folding (RFC 5322)', () => {
  it('should unfold headers with space continuation', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: This is a very long subject line
 that continues on the next line
 and even more on this line
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.subject).toBe('This is a very long subject line that continues on the next line and even more on this line');
  });

  it('should unfold headers with tab continuation', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Folded subject
\twith tab continuation
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.subject).toContain('Folded subject');
    expect(result.emails[0].metadata.subject).toContain('with tab continuation');
  });
});

describe('MBOX Parser - Multiple Header Values', () => {
  it('should preserve multiple Received headers', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Test
Received: from server1.example.com by server2.example.com
Received: from server2.example.com by server3.example.com
Received: from server3.example.com by server4.example.com
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].headers['received']).toHaveLength(3);
    expect(result.emails[0].headers['received'][0]).toContain('server1.example.com');
    expect(result.emails[0].headers['received'][1]).toContain('server2.example.com');
    expect(result.emails[0].headers['received'][2]).toContain('server3.example.com');
  });

  it('should handle multiple recipients', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: alice@example.com, bob@example.com
Cc: charlie@example.com, dave@example.com
Subject: Test
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.to).toContain('alice@example.com');
    expect(result.emails[0].metadata.to).toContain('bob@example.com');
    expect(result.emails[0].metadata.cc).toContain('charlie@example.com');
    expect(result.emails[0].metadata.cc).toContain('dave@example.com');
  });
});

describe('MBOX Parser - Email Threading', () => {
  it('should parse In-Reply-To header', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Re: Original
In-Reply-To: <original@example.com>
Message-ID: <reply@example.com>

This is a reply.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.inReplyTo).toBe('<original@example.com>');
  });

  it('should parse References header', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Re: Thread
References: <msg1@example.com> <msg2@example.com> <msg3@example.com>
In-Reply-To: <msg3@example.com>
Message-ID: <msg4@example.com>

Thread reply.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.references).toHaveLength(3);
    expect(result.emails[0].metadata.references).toContain('<msg1@example.com>');
    expect(result.emails[0].metadata.references).toContain('<msg2@example.com>');
    expect(result.emails[0].metadata.references).toContain('<msg3@example.com>');
  });
});

describe('MBOX Parser - Line Ending Normalization', () => {
  it('should handle CRLF line endings', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024\r\nFrom: sender@example.com\r\nTo: recipient@example.com\r\nSubject: CRLF Test\r\nMessage-ID: <test@example.com>\r\n\r\nBody with CRLF.`;

    const result = parser.parse(mboxContent);

    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].metadata.subject).toBe('CRLF Test');
  });

  it('should handle LF line endings', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024\nFrom: sender@example.com\nTo: recipient@example.com\nSubject: LF Test\nMessage-ID: <test@example.com>\n\nBody with LF.`;

    const result = parser.parse(mboxContent);

    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].metadata.subject).toBe('LF Test');
  });

  it('should handle mixed line endings', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024\r\nFrom: sender@example.com\nTo: recipient@example.com\r\nSubject: Mixed Test\nMessage-ID: <test@example.com>\n\nBody.`;

    const result = parser.parse(mboxContent);

    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].metadata.subject).toBe('Mixed Test');
  });
});

describe('MBOX Parser - Address Parsing', () => {
  it('should parse simple email addresses', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Test
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.from).toContain('sender@example.com');
    expect(result.emails[0].metadata.to).toContain('recipient@example.com');
  });

  it('should parse addresses with display names', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: Alice Smith <alice@example.com>
To: Bob Jones <bob@example.com>
Subject: Test
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.from).toContain('alice@example.com');
    expect(result.emails[0].metadata.to).toContain('bob@example.com');
  });

  it('should parse quoted display names', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: "Smith, Alice" <alice@example.com>
To: "Jones, Bob" <bob@example.com>
Subject: Test
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].metadata.from).toContain('alice@example.com');
    expect(result.emails[0].metadata.to).toContain('bob@example.com');
  });
});

describe('MBOX Parser - Statistics', () => {
  it('should report accurate statistics', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Test
Message-ID: <test@example.com>

Body.`;

    const result = parser.parse(mboxContent);

    expect(result.stats.totalEmails).toBe(1);
    expect(result.stats.totalBytes).toBe(mboxContent.length);
    expect(result.stats.parseTime).toBeGreaterThan(0);
    expect(result.stats.avgEmailSize).toBe(mboxContent.length);
  });
});
