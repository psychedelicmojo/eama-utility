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

  it('should unescape From lines in body', () => {
    const parser = new MBOXParser();
    const mboxContent = `From sender@example.com Mon Jan 01 10:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: From Escaping Test
Message-ID: <test@example.com>

>From this line should be unescaped
Normal line
>From another escaped line`;

    const result = parser.parse(mboxContent);

    expect(result.emails[0].body.text).toContain('From this line should be unescaped');
    expect(result.emails[0].body.text).not.toContain('>From');
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
});
