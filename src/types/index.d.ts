// src/types/index.d.ts

export interface Email {
  uid: string;
  messageId: string;
  headers: Record<string, string[]>;
  body: EmailBody;
  metadata: EmailMetadata;
  temporaryEdits?: HeaderEdits;
  rawSize: number;
}

export interface EmailBody {
  text: string;
  html: string;
  raw: string;
  attachments?: Attachment[];
}

export interface EmailMetadata {
  date: Date | null;
  from: Address[];
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  subject: string;
  inReplyTo?: string;
  references?: string[];
  receivedChain?: ReceivedHeader[];
}

export interface Address {
  name?: string;
  address: string;
}

export interface ReceivedHeader {
  from: string;
  by: string;
  with?: string;
  id?: string;
  for?: string;
  date?: Date;
  raw: string;
}

export interface Attachment {
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  data?: ArrayBuffer;
}

export interface UserMetadata {
  favorites: Set<string>;
  notes: Map<string, Note>;
  headerPreferences: HeaderVisibilityPrefs;
  lastUpdated: Date;
}

export interface Note {
  uid: string;
  emailUid: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface HeaderVisibilityPrefs {
  hiddenHeaders: Set<string>;
  alwaysShowHeaders: Set<string>;
  defaultView: 'all' | 'standard' | 'minimal';
}

export interface HeaderEdits {
  [headerName: string]: string;
}

export interface SearchQuery {
  text?: string;
  from?: string;
  to?: string;
  subject?: string;
  dateFrom?: Date;
  dateTo?: Date;
  headers?: Record<string, string>;
  favorites?: boolean;
  hasNotes?: boolean;
  bodyContains?: string;
}

export interface SearchResults {
  emails: Email[];
  total: number;
  query: SearchQuery;
  executionTime: number;
  page: number;
  pageSize: number;
}

export interface ParseProgress {
  percent: number;
  emailsProcessed: number;
  bytesProcessed: number;
  currentEmail?: string;
  estimatedTimeRemaining?: number;
}

export interface ParseError {
  type: 'MALFORMED_HEADER' | 'ENCODING_ERROR' | 'FROM_LINE_ERROR' | 'CRITICAL';
  message: string;
  context?: string;
  emailIndex?: number;
  recoverable: boolean;
}

export interface ParseResult {
  emails: Email[];
  errors: ParseError[];
  stats: ParseStats;
}

export interface ParseStats {
  totalEmails: number;
  totalBytes: number;
  parseTime: number;
  avgEmailSize: number;
  errorCount: number;
}
