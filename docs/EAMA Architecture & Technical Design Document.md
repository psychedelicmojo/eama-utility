eama_architecture_doc.md
# EAMA Architecture & Technical Design Document

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  React Application                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
│  │  │   UI     │  │  State   │  │   Service Layer   │ │   │
│  │  │Components│←→│Management│←→│  (Business Logic) │ │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                              ↓                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Web Worker (Parser Thread)             │   │
│  │  ┌──────────────┐  ┌────────────────────────────┐ │   │
│  │  │ MBOX Parser  │  │  Email Indexing Engine    │ │   │
│  │  └──────────────┘  └────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                              ↓                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Storage Layer                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │   │
│  │  │ IndexedDB  │  │  Memory    │  │   Session    │ │   │
│  │  │  (Cache)   │  │   Store    │  │   Storage    │ │   │
│  │  └────────────┘  └────────────┘  └──────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │    Firestore     │        │   Google App Script      │  │
│  │   (User Data)    │        │    (Gmail Gateway)       │  │
│  └──────────────────┘        └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

The application follows a modular, component-based architecture with clear separation of concerns:

- **Presentation Layer**: React components with Tailwind CSS
- **Business Logic Layer**: Service classes for email operations
- **Data Access Layer**: Abstracted storage interfaces
- **Background Processing**: Web Workers for CPU-intensive tasks

## 2. Core Components Design

### 2.1 MBOX Parser Module

```typescript
interface MBOXParser {
  parseFile(file: File): AsyncGenerator<ParsedEmail>;
  validateMBOX(content: ArrayBuffer): ValidationResult;
  extractHeaders(rawEmail: string): EmailHeaders;
  unescapeFromLines(body: string): string;
}

class MBOXParserWorker implements MBOXParser {
  private readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  private readonly FROM_LINE_REGEX = /^From .+$/gm;
  
  async *parseFile(file: File): AsyncGenerator<ParsedEmail> {
    const reader = file.stream().getReader();
    let buffer = '';
    let emailCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      const emails = this.extractEmails(buffer);
      
      for (const email of emails) {
        yield this.parseEmail(email, ++emailCount);
      }
      
      // Keep incomplete email in buffer
      buffer = this.getIncompleteEmail(buffer);
    }
  }
}
```

### 2.2 Email Data Model

```typescript
interface Email {
  uid: string;                    // Application-generated unique ID
  messageId: string;              // RFC 5322 Message-ID
  headers: Map<string, string[]>; // All headers (multi-value support)
  body: EmailBody;
  metadata: EmailMetadata;
  temporaryEdits?: HeaderEdits;  // In-memory modifications
}

interface EmailBody {
  text?: string;
  html?: string;
  raw: string;
  attachments: Attachment[];
}

interface EmailMetadata {
  date: Date;
  from: Address[];
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  subject: string;
  inReplyTo?: string;
  references?: string[];
  receivedChain: ReceivedHeader[];
}

interface UserMetadata {
  favorites: Set<string>;         // Email UIDs
  notes: Map<string, Note>;       // UID -> Note
  headerPreferences: HeaderVisibilityPrefs;
}
```

### 2.3 Storage Architecture

```typescript
class StorageManager {
  private memoryStore: InMemoryStore;
  private indexedDB: IndexedDBStore;
  private firestore: FirestoreClient;
  
  // Layered storage strategy
  async getEmail(uid: string): Promise<Email | null> {
    // L1: Memory cache
    let email = await this.memoryStore.get(uid);
    if (email) return email;
    
    // L2: IndexedDB cache
    email = await this.indexedDB.get(uid);
    if (email) {
      await this.memoryStore.set(uid, email);
      return email;
    }
    
    return null;
  }
  
  async saveUserMetadata(userId: string, metadata: UserMetadata): Promise<void> {
    const path = `/artifacts/${APP_ID}/users/${userId}/eama_preferences`;
    await this.firestore.set(path, this.encryptSensitiveData(metadata));
  }
}
```

## 3. Feature Implementation Details

### 3.1 Search and Filtering System

```typescript
class SearchEngine {
  private index: SearchIndex;
  
  constructor() {
    this.index = new InvertedIndex();
  }
  
  async indexEmail(email: Email): Promise<void> {
    // Index headers
    for (const [key, values] of email.headers) {
      this.index.addTerm(`header:${key}`, email.uid, values.join(' '));
    }
    
    // Index body (tokenized)
    const tokens = this.tokenize(email.body.text || '');
    tokens.forEach(token => {
      this.index.addTerm('body', email.uid, token);
    });
    
    // Index metadata
    this.index.addTerm('from', email.uid, email.metadata.from.map(a => a.address));
    this.index.addTerm('subject', email.uid, email.metadata.subject);
  }
  
  search(query: SearchQuery): SearchResults {
    const results = this.index.search(query);
    return this.rankResults(results, query);
  }
}
```

### 3.2 Header Comparison Engine

```typescript
class ComparisonEngine {
  compareEmails(emails: Email[], options: ComparisonOptions): ComparisonResult {
    const headers = this.extractCommonHeaders(emails);
    const matrix = this.buildComparisonMatrix(emails, headers);
    
    return {
      emails: emails.map(e => ({
        uid: e.uid,
        subject: e.metadata.subject,
        headers: this.normalizeHeaders(e.headers)
      })),
      differences: this.identifyDifferences(matrix),
      alignment: this.alignHeaders(matrix, options)
    };
  }
  
  private alignHeaders(matrix: HeaderMatrix, options: ComparisonOptions): AlignedHeaders {
    // Implement vertical alignment algorithm
    const aligned = new Map<string, AlignedRow>();
    
    for (const headerName of options.headersToCompare) {
      aligned.set(headerName, {
        name: headerName,
        values: matrix.getRow(headerName),
        differences: this.highlightDifferences(matrix.getRow(headerName))
      });
    }
    
    return aligned;
  }
}
```

### 3.3 Export System with Edit Support

```typescript
class MBOXExporter {
  async exportToMBOX(emails: Email[], options: ExportOptions): Promise<Blob> {
    const chunks: string[] = [];
    
    for (const email of emails) {
      // Apply temporary edits if present
      const finalEmail = this.applyTemporaryEdits(email);
      
      // Generate MBOX entry
      const mboxEntry = this.generateMBOXEntry(finalEmail);
      
      // Ensure proper From_ line escaping
      const escapedEntry = this.escapeFromLines(mboxEntry);
      
      chunks.push(escapedEntry);
    }
    
    return new Blob(chunks, { type: 'application/mbox' });
  }
  
  private applyTemporaryEdits(email: Email): Email {
    if (!email.temporaryEdits) return email;
    
    const edited = structuredClone(email);
    for (const [header, newValue] of email.temporaryEdits) {
      edited.headers.set(header, [newValue]);
    }
    
    return edited;
  }
  
  private escapeFromLines(content: string): string {
    // Escape "From " at beginning of lines in email body
    return content.replace(/^(>*From )/gm, '>$1');
  }
}
```

## 4. Security Implementation

### 4.1 Token Management

```typescript
class TokenManager {
  private tokenStore: SecureTokenStore;
  
  async initialize(): Promise<void> {
    // Generate encryption key using Web Crypto API
    this.encryptionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  async storeToken(token: OAuthToken): Promise<void> {
    const encrypted = await this.encrypt(token);
    // Store only in memory by default
    this.tokenStore.setMemory(encrypted);
    
    // Optional: persist encrypted to IndexedDB
    if (this.options.persistTokens) {
      await this.tokenStore.setPersistent(encrypted);
    }
  }
  
  async getToken(): Promise<OAuthToken | null> {
    const encrypted = this.tokenStore.getMemory() || 
                     await this.tokenStore.getPersistent();
    
    if (!encrypted) return null;
    
    return await this.decrypt(encrypted);
  }
}
```

### 4.2 Content Sanitization

```typescript
class EmailSanitizer {
  private sanitizer: DOMPurify;
  
  sanitizeEmailBody(html: string): string {
    // Configure DOMPurify for email content
    const config = {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
      FORBID_CONTENTS: ['script', 'style'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onclick', 'onmouseover', 'onerror', 'onload']
    };
    
    return this.sanitizer.sanitize(html, config);
  }
  
  renderInSandbox(content: string): HTMLElement {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-same-origin');
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" 
                content="default-src 'none'; style-src 'unsafe-inline';">
        </head>
        <body>${content}</body>
      </html>
    `;
    
    return iframe;
  }
}
```

## 5. Performance Optimization

### 5.1 Progressive Loading Strategy

```typescript
class ProgressiveLoader {
  async loadMBOX(file: File, onProgress: ProgressCallback): Promise<void> {
    const worker = new Worker('mbox-parser.worker.js');
    const totalSize = file.size;
    let processedSize = 0;
    
    worker.postMessage({ command: 'parse', file });
    
    worker.onmessage = async (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'email':
          await this.processEmail(data.email);
          processedSize += data.bytesProcessed;
          onProgress({
            percent: (processedSize / totalSize) * 100,
            emailsProcessed: data.emailCount
          });
          break;
          
        case 'complete':
          await this.finalizeLoad();
          break;
          
        case 'error':
          this.handleError(data.error);
          break;
      }
    };
  }
}
```

### 5.2 Virtual Scrolling for Email List

```typescript
class VirtualEmailList extends React.Component {
  private virtualizer: Virtualizer;
  
  constructor(props: EmailListProps) {
    super(props);
    
    this.virtualizer = new Virtualizer({
      itemCount: props.emails.length,
      itemHeight: 80, // Fixed height per email row
      buffer: 5,       // Render 5 extra items outside viewport
      container: this.containerRef
    });
  }
  
  render() {
    const visibleEmails = this.virtualizer.getVisibleItems();
    
    return (
      <div ref={this.containerRef} className="email-list-container">
        <div style={{ height: this.virtualizer.getTotalHeight() }}>
          {visibleEmails.map(({ index, offset }) => (
            <EmailListItem
              key={this.props.emails[index].uid}
              email={this.props.emails[index]}
              style={{ transform: `translateY(${offset}px)` }}
            />
          ))}
        </div>
      </div>
    );
  }
}
```

## 6. Gmail Integration Architecture

### 6.1 Asynchronous Communication Model

```typescript
// Client-side integration point
class GmailIntegration {
  private endpoint: string;
  private pollInterval: number = 30000; // 30 seconds
  
  async initializeConnection(userId: string): Promise<void> {
    // Register webhook endpoint with GAS
    const registration = await this.registerWebhook(userId);
    
    // Start polling for updates
    this.startPolling(registration.sessionId);
  }
  
  private async registerWebhook(userId: string): Promise<Registration> {
    // Call Google App Script web app endpoint
    const response = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        action: 'register',
        userId,
        webhookUrl: `${window.location.origin}/gmail-webhook`
      })
    });
    
    return response.json();
  }
  
  private startPolling(sessionId: string): void {
    setInterval(async () => {
      const updates = await this.checkForUpdates(sessionId);
      if (updates.hasNewEmails) {
        await this.fetchNewEmails(updates.emailIds);
      }
    }, this.pollInterval);
  }
}
```

### 6.2 Google App Script Design

```javascript
// Google App Script (runs in Google's infrastructure)
function doPost(e) {
  const request = JSON.parse(e.postData.contents);
  
  switch (request.action) {
    case 'register':
      return handleRegistration(request);
      
    case 'fetch':
      return fetchEmails(request);
      
    case 'checkUpdates':
      return checkForUpdates(request);
  }
}

function fetchEmails(request) {
  const threads = GmailApp.search(request.query, 0, request.limit);
  const emails = [];
  
  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      emails.push({
        messageId: message.getId(),
        headers: extractHeaders(message),
        body: message.getBody(),
        date: message.getDate()
      });
    });
  });
  
  // Store in temporary cache for async retrieval
  CacheService.getUserCache().put(
    request.sessionId,
    JSON.stringify(emails),
    600 // 10 minute expiry
  );
  
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, emailCount: emails.length }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 7. Testing Architecture

### 7.1 Test Suite Structure

```typescript
describe('MBOX Parser', () => {
  describe('Standard Format Parsing', () => {
    it('should parse single email with standard headers', async () => {
      const mbox = loadTestFile('standard-single.mbox');
      const emails = await parseAll(mbox);
      
      expect(emails).toHaveLength(1);
      expect(emails[0].messageId).toBe('<test@example.com>');
    });
    
    it('should handle From-line escaping correctly', async () => {
      const mbox = loadTestFile('from-escaped.mbox');
      const emails = await parseAll(mbox);
      
      expect(emails[0].body.text).not.toContain('>From ');
      expect(emails[0].body.text).toContain('From ');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle folded headers', async () => {
      const mbox = loadTestFile('folded-headers.mbox');
      const emails = await parseAll(mbox);
      
      expect(emails[0].headers.get('Subject')[0]).toBe(
        'This is a very long subject that spans multiple lines'
      );
    });
    
    it('should handle multiple Received headers', async () => {
      const mbox = loadTestFile('multiple-received.mbox');
      const emails = await parseAll(mbox);
      
      expect(emails[0].metadata.receivedChain).toHaveLength(5);
    });
  });
  
  describe('Performance', () => {
    it('should parse 1000 emails within 5 seconds', async () => {
      const mbox = loadTestFile('performance-1k.mbox');
      const startTime = performance.now();
      
      const emails = await parseAll(mbox);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(5000);
      expect(emails).toHaveLength(1000);
    });
  });
});
```

### 7.2 Fuzz Testing Implementation

```typescript
class FuzzTester {
  async fuzzParser(iterations: number = 1000): Promise<FuzzReport> {
    const report = new FuzzReport();
    
    for (let i = 0; i < iterations; i++) {
      const malformedMbox = this.generateMalformedMbox();
      
      try {
        await this.parser.parse(malformedMbox);
        report.addSuccess();
      } catch (error) {
        report.addFailure(error, malformedMbox);
        
        // Verify graceful failure
        if (error.type !== 'ParseError') {
          report.addCriticalFailure(error);
        }
      }
    }
    
    return report;
  }
  
  private generateMalformedMbox(): string {
    const mutations = [
      () => this.corruptFromLine(),
      () => this.insertNullBytes(),
      () => this.createExtremelyLongLine(),
      () => this.mixEncodings(),
      () => this.breakHeaderFormat()
    ];
    
    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    return mutation();
  }
}
```

## 8. Deployment Configuration

### 8.1 Build Configuration (Vite)

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              }
            }
          }
        ]
      }
    })
  ],
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'parser': ['./src/workers/mbox-parser.worker.js']
        }
      }
    }
  }
});
```

### 8.2 Environment Configuration

```typescript
// config/environment.ts
interface EnvironmentConfig {
  firestore: {
    projectId: string;
    apiKey: string;
    authDomain: string;
  };
  gmail: {
    clientId: string;
    scopes: string[];
    gasEndpoint: string;
  };
  features: {
    enableGmailIntegration: boolean;
    enableRemoteLogging: boolean;
    maxEmailsPerSession: number;
  };
  security: {
    enableTokenPersistence: boolean;
    requireEncryption: boolean;
    cspPolicy: string;
  };
}

const config: Record<'development' | 'production', EnvironmentConfig> = {
  development: {
    firestore: {
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN
    },
    gmail: {
      clientId: process.env.VITE_GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      gasEndpoint: process.env.VITE_GAS_ENDPOINT
    },
    features: {
      enableGmailIntegration: true,
      enableRemoteLogging: true,
      maxEmailsPerSession: 5000
    },
    security: {
      enableTokenPersistence: false,
      requireEncryption: true,
      cspPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'"
    }
  },
  production: {
    // Production configuration with stricter security
    // ...
  }
};

export default config[import.meta.env.MODE] || config.development;
```

## 9. Monitoring and Diagnostics

### 9.1 Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  
  startTimer(operation: string): void {
    this.metrics.set(operation, {
      startTime: performance.now(),
      operation
    });
  }
  
  endTimer(operation: string): number {
    const metric = this.metrics.get(operation);
    if (!metric) return 0;
    
    const duration = performance.now() - metric.startTime;
    
    // Log to structured logging
    logger.info('Performance metric', {
      operation,
      duration,
      timestamp: new Date().toISOString()
    });
    
    // Update diagnostics panel
    this.updateDiagnostics(operation, duration);
    
    return duration;
  }
  
  getMemoryUsage(): MemoryInfo {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      };
    }
    return null;
  }
}
```

### 9.2 Diagnostics Panel Component

```typescript
const DiagnosticsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<DiagnosticsData>();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        memory: performanceMonitor.getMemoryUsage(),
        workerStatus: workerManager.getStatus(),
        cacheStats: storageManager.getCacheStats(),
        lastErrors: errorLogger.getRecentErrors(5),
        activeTokens: tokenManager.getTokenStatus()
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="fixed bottom-0 right-0 p-4 bg-gray-900 text-white rounded-tl-lg">
      <h3 className="font-bold mb-2">Diagnostics</h3>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Memory: {formatBytes(metrics?.memory?.usedJSHeapSize)}</div>
        <div>Worker: {metrics?.workerStatus}</div>
        <div>Cached: {metrics?.cacheStats?.emailCount} emails</div>
        <div>Errors: {metrics?.lastErrors?.length || 0}</div>
      </div>
      
      {metrics?.lastErrors?.map((error, i) => (
        <div key={i} className="text-red-400 text-xs mt-1">
          {error.message}
        </div>
      ))}
    </div>
  );
};
```

## 10. API Reference

### 10.1 Core Service APIs

```typescript
// Email Service API
interface EmailService {
  loadMBOX(file: File): Promise<LoadResult>;
  search(query: SearchQuery): Promise<SearchResults>;
  getEmail(uid: string): Promise<Email>;
  updateHeaders(uid: string, edits: HeaderEdits): Promise<void>;
  exportEmails(uids: string[], format: 'mbox'): Promise<Blob>;
}

// User Metadata Service API
interface UserMetadataService {
  toggleFavorite(uid: string): Promise<void>;
  addNote(uid: string, note: string): Promise<void>;
  updateHeaderPreferences(prefs: HeaderVisibilityPrefs): Promise<void>;
  sync(): Promise<void>;
}

// Gmail Integration API
interface GmailService {
  connect(userId: string): Promise<ConnectionStatus>;
  fetchEmails(query: string, limit: number): Promise<Email[]>;
  disconnect(): Promise<void>;
}
```

### 10.2 Event System

```typescript
// Event definitions
enum AppEvents {
  EMAIL_LOADED = 'email:loaded',
  PARSE_PROGRESS = 'parse:progress',
  PARSE_COMPLETE = 'parse:complete',
  SEARCH_COMPLETE = 'search:complete',
  EXPORT_READY = 'export:ready',
  ERROR_OCCURRED = 'error:occurred'
}

// Event emitter usage
class EventBus extends EventEmitter {
  emitEmailLoaded(email: Email): void {
    this.emit(AppEvents.EMAIL_LOADED, { email });
  }
  
  onEmailLoaded(callback: (data: { email: Email }) => void): void {
    this.on(AppEvents.EMAIL_LOADED, callback);
  }
}
```

## 11. Error Handling Strategy

### 11.1 Error Types and Recovery

```typescript
enum ErrorType {
  PARSE_ERROR = 'PARSE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR'
}

class ErrorHandler {
  handle(error: AppError): ErrorRecoveryStrategy {
    switch (error.type) {
      case ErrorType.PARSE_ERROR:
        return this.handleParseError(error);
      
      case ErrorType.STORAGE_ERROR:
        return this.handleStorageError(error);
      
      case ErrorType.SECURITY_ERROR:
        return this.handleSecurityError(error);
      
      default:
        return this.handleGenericError(error);
    }
  }
  
  private handleParseError(error: AppError): ErrorRecoveryStrategy {
    return {
      action: 'SKIP_AND_CONTINUE',
      userMessage: 'Some emails could not be parsed and were skipped',
      logLevel: 'WARNING',
      recovery: () => this.skipMalformedEmail(error.context)
    };
  }
  
  private handleStorageError(error: AppError): ErrorRecoveryStrategy {
    return {
      action: 'RETRY_WITH_FALLBACK',
      userMessage: 'Storage error occurred, using fallback storage',
      logLevel: 'ERROR',
      recovery: () => this.switchToFallbackStorage()
    };
  }
  
  private handleSecurityError(error: AppError): ErrorRecoveryStrategy {
    return {
      action: 'HALT_AND_NOTIFY',
      userMessage: 'Security violation detected. Operation cancelled.',
      logLevel: 'CRITICAL',
      recovery: () => this.terminateOperation(error)
    };
  }
  
  private handleGenericError(error: AppError): ErrorRecoveryStrategy {
    return {
      action: 'LOG_AND_CONTINUE',
      userMessage: 'An error occurred but the operation will continue',
      logLevel: 'ERROR',
      recovery: () => this.logError(error)
    };
  }
}

### 11.2 User Notification System

```typescript
class NotificationManager {
  private toasts: Toast[] = [];
  
  showError(message: string, details?: ErrorDetails): void {
    this.show({
      type: 'error',
      message,
      details,
      duration: 5000,
      actions: [
        { label: 'View Details', onClick: () => this.showErrorDetails(details) },
        { label: 'Dismiss', onClick: () => this.dismiss() }
      ]
    });
  }
  
  showWarning(message: string): void {
    this.show({
      type: 'warning',
      message,
      duration: 3000
    });
  }
  
  showSuccess(message: string): void {
    this.show({
      type: 'success',
      message,
      duration: 2000
    });
  }
  
  showProgress(operation: string, progress: number): void {
    this.show({
      type: 'progress',
      message: operation,
      progress,
      persistent: true
    });
  }
}
```

## 12. Development Workflow

### 12.1 Development Setup

```bash
# Project structure
eama/
├── src/
│   ├── components/         # React components
│   │   ├── EmailList/
│   │   ├── EmailDetail/
│   │   ├── ComparisonView/
│   │   └── common/
│   ├── services/           # Business logic
│   │   ├── EmailService.ts
│   │   ├── SearchEngine.ts
│   │   ├── StorageManager.ts
│   │   └── GmailIntegration.ts
│   ├── workers/            # Web Workers
│   │   ├── mbox-parser.worker.ts
│   │   └── search-indexer.worker.ts
│   ├── utils/              # Utilities
│   │   ├── sanitizer.ts
│   │   ├── logger.ts
│   │   └── crypto.ts
│   ├── types/              # TypeScript definitions
│   │   └── index.d.ts
│   └── App.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/           # Test MBOX files
│   └── e2e/
├── config/
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── environment.ts
└── package.json
```

### 12.2 Development Commands

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:fuzz": "node tests/fuzz/runner.js",
    "lint": "eslint src --ext ts,tsx",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "analyze": "vite build --mode analyze",
    "benchmark": "node tests/performance/benchmark.js",
    "generate-types": "tsc --declaration --emitDeclarationOnly"
  }
}
```

### 12.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Performance benchmark
        run: npm run benchmark
        env:
          BENCHMARK_THRESHOLD: '5000' # 5 seconds for 1000 emails
      
      - name: Build application
        run: npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security audit
        run: npm audit --audit-level=moderate
      
      - name: OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          path: '.'
          format: 'HTML'
```

## 13. Migration and Upgrade Path

### 13.1 Data Migration Strategy

```typescript
class DataMigrationManager {
  async migrate(fromVersion: string, toVersion: string): Promise<void> {
    const migrations = this.getMigrationPath(fromVersion, toVersion);
    
    for (const migration of migrations) {
      try {
        await this.backupCurrentData();
        await migration.up();
        await this.validateMigration(migration);
      } catch (error) {
        await migration.down();
        throw new MigrationError(`Migration ${migration.version} failed`, error);
      }
    }
  }
  
  private migrations: Migration[] = [
    {
      version: '1.0.0',
      up: async () => {
        // Initial schema
        await this.createInitialSchema();
      },
      down: async () => {
        await this.dropAllTables();
      }
    },
    {
      version: '1.1.0',
      up: async () => {
        // Add notes feature
        await this.addNotesTable();
        await this.migrateExistingData();
      },
      down: async () => {
        await this.dropNotesTable();
      }
    }
  ];
}
```

### 13.2 Backward Compatibility

```typescript
class CompatibilityLayer {
  async loadLegacyData(data: unknown): Promise<Email[]> {
    const version = this.detectDataVersion(data);
    
    switch (version) {
      case 'v1':
        return this.convertV1ToCurrentFormat(data);
      case 'v2':
        return this.convertV2ToCurrentFormat(data);
      default:
        throw new Error(`Unsupported data version: ${version}`);
    }
  }
  
  private convertV1ToCurrentFormat(data: V1Data): Email[] {
    return data.emails.map(oldEmail => ({
      uid: oldEmail.id || this.generateUID(),
      messageId: oldEmail.messageId,
      headers: this.convertHeaders(oldEmail.headers),
      body: {
        text: oldEmail.body,
        html: oldEmail.htmlBody,
        raw: oldEmail.rawContent || '',
        attachments: []
      },
      metadata: this.extractMetadata(oldEmail)
    }));
  }
}
```

## 14. Accessibility Implementation

### 14.1 ARIA and Keyboard Navigation

```typescript
const EmailList: React.FC<EmailListProps> = ({ emails }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, emails.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        openEmail(emails[selectedIndex]);
        break;
      case '/':
        e.preventDefault();
        focusSearchBox();
        break;
    }
  };
  
  return (
    <div
      role="list"
      aria-label="Email list"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="email-list"
    >
      {emails.map((email, index) => (
        <div
          key={email.uid}
          role="listitem"
          aria-selected={index === selectedIndex}
          aria-label={`Email from ${email.metadata.from[0].name}, subject: ${email.metadata.subject}`}
          tabIndex={index === selectedIndex ? 0 : -1}
          className={cn(
            'email-item',
            index === selectedIndex && 'selected'
          )}
        >
          <EmailListItem email={email} />
        </div>
      ))}
    </div>
  );
};
```

### 14.2 Screen Reader Support

```typescript
const ComparisonView: React.FC<ComparisonProps> = ({ emails }) => {
  return (
    <div role="table" aria-label="Email comparison table">
      <div role="rowgroup">
        <div role="row">
          <div role="columnheader">Header</div>
          {emails.map((email, i) => (
            <div key={email.uid} role="columnheader">
              Email {i + 1}
            </div>
          ))}
        </div>
      </div>
      
      <div role="rowgroup">
        {COMPARISON_HEADERS.map(header => (
          <div key={header} role="row">
            <div role="cell">{header}</div>
            {emails.map(email => (
              <div key={email.uid} role="cell">
                {email.headers.get(header)?.[0] || 'N/A'}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="sr-only" aria-live="polite">
        Comparing {emails.length} emails
      </div>
    </div>
  );
};
```

## 15. Future Enhancements

### 15.1 Planned Features

1. **Advanced Analytics**
   - Email thread reconstruction
   - Sender/recipient network visualization
   - Time-based email flow analysis
   - Attachment type distribution

2. **Machine Learning Integration**
   - Spam detection scoring
   - Email categorization
   - Anomaly detection for security
   - Smart search suggestions

3. **Extended Data Sources**
   - Outlook PST file support
   - IMAP/POP3 direct connection
   - Exchange Web Services integration
   - Thunderbird profile import

4. **Collaboration Features**
   - Shared analysis sessions
   - Team annotations
   - Export to forensic report formats
   - Integration with ticketing systems

### 15.2 Scalability Roadmap

```typescript
// Future architecture for handling larger datasets
class ScalableEmailEngine {
  // Use IndexedDB for primary storage instead of memory
  private storage: IndexedDBPrimaryStorage;
  
  // Implement pagination at the storage level
  async *streamEmails(query: Query): AsyncGenerator<Email> {
    const cursor = await this.storage.openCursor(query);
    
    while (cursor) {
      yield cursor.value;
      cursor = await cursor.continue();
    }
  }
  
  // Add WebAssembly parser for performance
  async parseWithWASM(mbox: ArrayBuffer): Promise<Email[]> {
    const wasmModule = await this.loadWASMParser();
    return wasmModule.parseMBOX(mbox);
  }
  
  // Implement distributed processing
  async processLargeFile(file: File): Promise<void> {
    const chunks = this.splitFile(file, CHUNK_SIZE);
    const workers = this.createWorkerPool(4);
    
    await Promise.all(
      chunks.map(chunk => 
        workers.process(chunk)
      )
    );
  }
}
```

## Appendix A: MBOX Format Specification

```
From sender@example.com Mon Jan 1 00:00:00 2024
From: sender@example.com
To: recipient@example.com
Subject: Example Email
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <unique@example.com>

This is the email body.
>From lines in the body must be escaped.

From another@example.com Mon Jan 1 00:01:00 2024
...
```

## Appendix B: Security Checklist

- [ ] All user input sanitized before rendering
- [ ] OAuth tokens encrypted before storage
- [ ] CSP headers configured correctly
- [ ] HTTPS enforced in production
- [ ] Firebase security rules reviewed
- [ ] PII redaction implemented
- [ ] Audit logging enabled
- [ ] Rate limiting on API calls
- [ ] Input size limits enforced
- [ ] Malicious file detection implemented