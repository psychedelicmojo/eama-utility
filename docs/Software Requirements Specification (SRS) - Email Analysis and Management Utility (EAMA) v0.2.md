# **Software Requirements Specification (SRS) \- Email Analysis and Management Utility (EAMA)**

## **1\. Introduction**

### **1.1. Purpose**

The purpose of the Email Analysis and Management Utility (EAMA) is to provide users with a standalone web application for deep analysis, filtering, comparison, and archival of email data sourced primarily from local MBOX files. A secondary objective is to define the necessary architecture for integration with Google services (specifically Gmail via Google App Script) as a data source. The application must prioritize usability, detailed header visibility, and adherence to email and MBOX standards.

### **1.2. Scope**

EAMA will provide the following core features:

1. **Data Ingestion:** Load emails from single or multi-part MBOX files.  
2. **Search & Filtering:** Allow sophisticated, multi-field searching across email metadata and content.  
3. **Display:** Present a list view and a detailed view of emails, with full control over header visibility.  
4. **Header Analysis:** Enable side-by-side comparison and temporary modification of email header values on an **in-memory copy** of the email data.  
5. **Data Management:** Support favoriting emails, adding persistent notes, and exporting emails back into MBOX format.

The scope explicitly **excludes** sending emails, real-time synchronization with external mail servers (other than the optional Gmail data source), or acting as a primary mail client.

### **1.3. Definitions, Acronyms, and Abbreviations**

| Term | Definition |
| :---- | :---- |
| **EAMA** | Email Analysis and Management Utility |
| **MBOX** | Standard file format for storing collections of email messages. |
| **RFC 5322** | Internet Message Format standard (defines email headers). |
| **Header** | Metadata fields of an email (e.g., Date, From, To, Subject). |
| **Google App Script** | Cloud-based JavaScript platform for extending Google Workspace. |
| **UID** | Unique Identifier for an email in the application. |

## **2\. Overall Description**

### **2.1. Product Perspective**

EAMA will be a standalone, client-side web application (HTML/CSS/JS or a single-file React/Angular implementation) designed for portability and local processing of MBOX files. **Bulk email data processing remains in-memory** for security and performance. Database storage (Firestore) will be used exclusively for storing user-specific metadata like preferences, favorited UIDs, and notes/comments.

### **2.2. User Characteristics**

The target user is expected to have a moderate to high level of technical proficiency, such as a systems administrator, developer, or security analyst, who requires detailed inspection and comparison of email headers for debugging, forensics, or compliance checks.

### **2.3. General Constraints**

* **Standards Compliance:** MBOX file generation MUST adhere strictly to the MBOX format specifications, including correct "From " line escaping. Header parsing and representation MUST comply with RFC 5322\.  
* **Security:** As the app handles potentially sensitive email data, all MBOX parsing and processing must be done client-side within the browser; the file contents must never be uploaded to a server.  
* **Data Source Integration:** The Gmail data source feature is constrained by Google App Script/Gmail API usage limits and security permissions, necessitating an asynchronous, trigger-based communication model.

## **3\. Specific Requirements**

### **3.1. Functional Requirements**

#### **3.1.1. Data Ingestion (MBOX)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-IN.100** | MBOX File Upload | The user MUST be able to select and upload one or more local MBOX files for processing. |
| **F-IN.101** | Multi-part MBOX Support | The application MUST correctly parse emails from multi-part MBOX files loaded sequentially. |
| **F-IN.102** | MBOX Parsing and Indexing | Upon load, the application MUST parse each email, extract all headers, and index the emails by a unique UID for fast retrieval. |
| **F-IN.103** | From Escaping Handling | The parser MUST correctly handle and unescape "From " lines within the email body according to MBOX standards. |

#### **3.1.2. Data Ingestion (Gmail / App Script)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-IN.200** | Gmail Access Endpoint Design | The application will define an integration point structured to communicate with Google App Script (GAS) via an asynchronous, trigger-initiated endpoint. This decouples the standalone UI from Gmail API/GAS execution, allowing GAS to push data or status updates. |

#### **3.1.3. Search and Filtering**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-SR.300** | Full-Text Search | Allow the user to perform a case-insensitive search across Subject, Sender, Recipients, and Body. |
| **F-SR.301** | Header Filtering | Allow filtering emails based on specific header values (e.g., HeaderName: value). |
| **F-SR.302** | Favorites Filter | Provide a dedicated filter or toggle to show only emails marked as favorite. |
| **F-SR.303** | Notes Filter | Provide a filter to show only emails that have user-added notes/comments. |

#### **3.1.4. Email and Header Display**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-DS.400** | Email List View | Display a paginated list of emails showing key headers (Date, From, Subject, Message-ID, Favorite status, Notes status). |
| **F-DS.401** | Detailed Header View | Upon selecting an email, display the email body and ALL associated headers in a readable, structured format. |
| **F-DS.402** | Header Visibility Control | The user MUST be able to toggle the visibility of individual or groups of headers (e.g., disable all Received headers). User preferences MUST be saved to Firestore (R-SEC.812). |

#### **3.1.5. Header Comparison and Editing**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-CMP.500** | Multi-Email Comparison View | Allow the user to select 2 to 4 emails and display their full headers side-by-side. Default displayed headers include: From, To, Subject, Date, Message-ID, In-Reply-To, References, and all Received headers. |
| **F-CMP.501** | Value Alignment | In the comparison view, header fields must be aligned vertically, showing corresponding values directly next to each other for easy comparison. |
| **F-CMP.502** | Temporary Header Editing | The user MUST be able to edit the value of a header field in the detailed or comparison view. This edit is TEMPORARY and applies only to the in-memory data model and is applied during MBOX export. |

#### **3.1.6. Data Management and Export**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-MGMT.600** | Favorites System | The user MUST be able to mark or unmark any email as a favorite. This state MUST be saved per email UID using Firestore (R-SEC.812). |
| **F-MGMT.601** | Export Selection | The user MUST be able to select individual emails, a filtered batch of emails, or all loaded emails for export. |
| **F-MGMT.602** | MBOX Export Generation | Generate a valid MBOX file containing the selected emails. The export MUST incorporate any **temporary header edits** made by the user (F-CMP.502) to the in-memory copy. |
| **F-MGMT.603** | Download Capability | Provide a mechanism for the user to download the newly generated MBOX file to their local machine. |
| **F-MGMT.604** | Notes/Comments | The user MUST be able to add, edit, and save a persistent text note or comment associated with each email UID (saved to Firestore, R-SEC.812). |

## **4\. Performance Requirements**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-PERF.800** | Target scale | The application MUST smoothly support hundreds to low-thousands of emails per loaded dataset (recommended design target: **100–5,000 emails**). |
| **R-PERF.801** | Load time | When loading an MBOX file up to the target size, initial parse \+ index MUST complete within **5 seconds** on a typical developer laptop (8-16GB RAM, recent CPU) for datasets ![][image1] 1,000 emails. For up to 5,000 emails, parsing should not block the UI and should provide progressive feedback (see R-UI.822). |
| **R-PERF.802** | Interaction latency | Typical interactive operations (search, filter, toggle header visibility, paging) MUST return results and update the UI within **2 seconds** (goal ![][image1] 500ms for simple operations on in-memory index). |
| **R-PERF.803** | Resource usage | CPU/memory usage MUST be bounded and avoid full synchronous blocking of the main UI thread; large parsing jobs MUST run in a **Web Worker** or equivalent. |
| **Acceptance criteria** | Benchmarks: parse \+ index 1,000 typical emails in ![][image1]5s on a specified dev machine; search of indexed fields returns first page in ![][image1]2s. Provide performance test script and recorded runs. |  |

## **5\. Security & Privacy Requirements**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-SEC.810** | Token handling & minimal scope | Any tokens used for Google services MUST follow OAuth 2.0 best practices: request minimal scopes, use OAuth 2.0 Authorization Code Flow with **PKCE** for client-side flows, avoid long-lived tokens when possible. Prefer short lived access tokens. |
| **R-SEC.811** | Token storage | Tokens MUST NOT be stored in localStorage or other insecure places. Recommended approaches: use in-memory token storage with option to persist encrypted tokens to IndexedDB or Firestore (see R-SEC.812). If persisting refresh tokens, **encrypt them** before storage with an application-level key derived from user credentials or a secure Web Crypto key. |
| **R-SEC.812** | Firestore security & persistence | Firestore storage MUST enforce security with strict Firebase Security Rules, least privilege access, and authentication checks. Persistence MUST use the explicit per-user isolation path: /artifacts/{appId}/users/{userId}/eama\_preferences. Any secrets stored in Firestore MUST be encrypted at the application layer. This covers favorites, notes, and user preferences (F-MGMT.600, F-MGMT.604, F-DS.402). |
| **R-SEC.813** | Input sanitization & rendering | Email bodies and headers MUST be sanitized before rendering: strip/neutralize scripts, inline event handlers, and suspicious CSS. Use a **whitelisting HTML sanitizer** (allow basic tags only) and render sanitized HTML in a sandboxed element/iframe with strict Content Security Policy (CSP). Attachments MUST be handled as downloads only (do not auto-execute). |
| **R-SEC.814** | Data handling & PII | Provide an explicit warning when users load real emails; include a toggle to mask or redact PII in the UI for testing. Logs MUST not include raw email bodies or unmasked PII unless developer toggles verbose debug mode (see R-LOG.832). |
| **R-SEC.815** | Threat & abuse | Define behavior for malicious inputs (extremely large emails, malformed headers): parser must fail gracefully, surface an error, and **isolate the offending message** from the rest of the data. |
| **Acceptance criteria** | Demonstrable OAuth flow using PKCE. Security rules reviewed. Sanitizer test suite that shows scripts removed and safe markup preserved. |  |

## **6\. UI / UX Requirements (Rapid-development, single dev \+ LLM)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-UI.820** | Design goals | Minimal, component-driven UI optimized for speed of development and maintainability. Use **Tailwind CSS** to accelerate build time. Keep visual complexity low to prioritize function over polish (R-NF.700). |
| **R-UI.821** | Layout & navigation | Primary panes: Email List (left or top), Detail/Headers View (right or below), and an optional Comparison Drawer/Modal. Provide consistent keyboard navigation and clear affordances for multi-select. |
| **R-UI.822** | Pagination & progressive loading | Use paginated list (page size 25–50) with quick jump/filters. For import (R-PERF.801), show **streaming/progressive indexing UI** with a progress bar and ability to view already-parsed emails while parsing continues. |
| **R-UI.823** | Comparison view | Comparison UI supports 2–4 emails, displayed in a grid with vertically aligned rows for header names (**sticky left column**). Include controls to toggle which headers appear and to enable “edit mode” per cell (edits apply to in-memory copy, F-CMP.502). |
| **R-UI.824** | Header editing & export flow | Editing should be inline, with clear indicators that changes are temporary/in-memory (e.g., orange badge **“unsaved edits”**). Provide an **Export Preview step** showing exactly how headers will be emitted to the MBOX before download. |
| **R-UI.825** | Rapid-dev specifics | Build using React \+ Vite or equivalent for very fast HMR. Use a component-first approach (List, ListItem, HeaderRow, ComparisonGrid). Use web workers for parsing (R-PERF.803); store parsed index in memory \+ optionally in IndexedDB for repeated dev runs. |
| **R-UI.826** | Accessibility & basic WCAG | Aim for WCAG 2.1 AA where feasible, but prioritize **keyboard operability**, high-contrast mode, and semantic HTML. Add ARIA roles for list and grid. |
| **R-UI.827** | Error/feedback patterns | **Non-blocking toast notifications** for transient errors; inline validation for malformed MBOX segments; modal for fatal errors with actionable guidance (R-NF.703). |
| **Acceptance criteria** | Clickable wireframe or prototype implementing the three main panes, progressive load behavior, and the comparison grid. Keyboard shortcuts for common actions. |  |

## **7\. Logging & Debugging**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-LOG.830** | Structured logging | Logging MUST be structured JSON with fields: {timestamp, level, module, uid?, action, message, meta}. Levels: ERROR, WARN, INFO, DEBUG, TRACE. |
| **R-LOG.831** | Local log store & export | Logs kept locally (IndexedDB) with configurable retention (default 7 days or 10,000 log lines). Provide a UI control to **download logs** as a JSON or NDJSON file for sharing. |
| **R-LOG.832** | Sensitive data scrubbing | By default, logs MUST **scrub email bodies** and replace sensitive headers (full addresses) with hashed placeholders unless the user enables verbose debugging (R-SEC.814). When verbose mode is enabled the UI must show a prominent security warning and require confirmation. |
| **R-LOG.833** | Remote logging (optional / opt-in) | Support optional opt-in upload of anonymized logs to a developer Firestore path for debugging; only when user consents and with a toggle to purge logs. Remote logs must follow the same scrubbing policy. |
| **R-LOG.834** | Runtime diagnostics | Provide a **developer diagnostics panel** showing: current memory usage, worker queue lengths, active token status (masked), last parse errors, and simple performance metrics (parse time, search time). |
| **Acceptance criteria** | Exported log file that follows the structured spec and a diagnostics panel showing live metrics. |  |

## **8\. Testing & Test Data (using real life emails)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-TST.840** | Test corpus & privacy | Maintain a test corpus composed of **sanitized real emails** that retain header complexity and edge cases (From-line escaping, broken headers, encodings). Include both standard and non-standard MBOX samples. Sanitize PII in the corpus before committing to repo if it's stored. |
| **R-TST.841** | Unit & integration test coverage | Parser unit tests MUST cover boundary cases for **From-line handling (F-IN.103)**, folded headers, multiple Received headers, different encodings (UTF-8, ISO-8859-1), CRLF vs LF EOLs. **Export tests (F-MGMT.602)**: exported MBOX must round-trip with Python mailbox and preserve Message-IDs and user edits applied (R-NF.702). |
| **R-TST.842** | Fuzz & malformed data tests | Add automated **fuzz tests** that feed randomly malformed headers and extremely long lines to the parser and validate graceful failure modes (R-SEC.815). |
| **R-TST.843** | Test automation & CI | Configure CI to run critical tests (parser, search, export) on each PR/push. Include a performance smoke test that measures parse time on a representative 1,000-email sample and fails if it exceeds thresholds (R-PERF.801). |
| **R-TST.844** | Real-email safety guidelines | Explicit developer instructions for working with real emails: keep data local, enable redact/mask features during dev, and never share raw datasets externally without consent. |
| **Acceptance criteria** | Test suite with parser/unit tests and CI job verifying basic parse \+ export correctness and a performance smoke test. |  |

## **9\. Glossary (expanded)**

| Term | Definition |
| :---- | :---- |
| **AppId** | Unique ID for the application instance or deployment. |
| **Artifact** | Storage container/path for user preferences and app metadata. |
| **CRLF** | Carriage Return \+ Line Feed (![][image1]) end-of-line marker used in email protocols. |
| **EOL** | End of line (CRLF or LF). |
| **Encoding** | Character encoding (UTF-8, ISO-8859-1, etc.). |
| **Env (development/production)** | Runtime environment settings. |
| **IndexedDB** | Browser storage mechanism for structured data; recommended for local caching. |
| **MBOX** | Standard plain-text format for storing email messages. |
| **Message-ID** | RFC-specified unique identifier for an email message. |
| **OAuth 2.0 \+ PKCE** | Authorization flow for public clients; preferred for browser-based apps. |
| **PKCE** | Proof Key for Code Exchange (mitigates authorization code interception). |
| **Sanitizer** | Library or function that removes or neutralizes unsafe HTML/CSS/JS before rendering. |
| **UID** | Unique identifier assigned by EAMA to each parsed message (application-level). |
| **Web Worker** | Browser API/worker thread for offloading heavy computation from the main UI thread. |

## **10\. Implementation Notes & Rapid-Dev Recommendations (one-person \+ LLM)**

**Tech stack recommendation:** React \+ Vite, Tailwind, shadcn/ui for components. Use **web-worker** for parsing heavy files (R-PERF.803); store parsed index in memory \+ optionally in IndexedDB for repeated dev runs. Firestore only for user metadata/preferences (R-SEC.812).

**Parsing approach:** Use a robust mbox parser library where available. If implementing custom parser: stream the file in chunks in a worker, detect ^From  lines, support RFC 5322 folding, and normalize line endings. Include unit tests that use your real-email test corpus (R-TST.841).

**Security libs:** Use a vetted HTML sanitizer (e.g., DOMPurify equivalent) and Web Crypto for token encryption (R-SEC.811, R-SEC.813).

**Logging:** Implement a small logging utility that writes to IndexedDB and supports immediate download (R-LOG.831).

**LLM \+ dev loop:** Keep a small set of templates and prompts for the LLM to generate component boilerplate, tests, and parsers—this accelerates the single-dev throughput.

## **11\. Traceability (quick map of new IDs → original features)**

| New Requirement | Original Feature/Constraint |
| :---- | :---- |
| **R-PERF.800–803** | Enhances F-IN.102 indexing and performance claims in 2.3 General Constraints. |
| **R-SEC.810–815** | Secures the Gmail integration (F-IN.200), Firestore (R-SEC.812 replaces R-NF.701), and parsing security obligations (R-SEC.813). |
| **R-UI.820–827** | Supports F-DS.400, F-DS.401, F-CMP.500, F-CMP.502, and replaces R-NF.700 (Usability). |
| **R-LOG.830–834** | Augments error handling (R-UI.827) and adds observability for dev/test. |
| **R-TST.840–844** | Provides acceptance and test criteria for F-IN.102, F-MGMT.602 (export roundtrip), and parser robustness (F-IN.103). |

## **12\. Architectural Decisions & Next Steps**

The following architectural decisions have been made or deferred:

1. **Gmail/App Script Execution Environment:** The application will be a **Standalone Web App** that uses trigger-based communication to interface with a separate Google App Script endpoint, decoupling the complex UI from the Google environment constraints. (F-IN.200)  
2. **MBOX Format and Encoding:** The parser will default to robust **UTF-8** detection and must handle various EOL characters and header folding for high accuracy, with unit tests confirming compliance. (R-TST.841)  
3. **Nature of Header Editing:** Editing applies only to the **in-memory data model** (F-CMP.502) and is incorporated only into the exported MBOX file, preserving the original file integrity. (F-MGMT.602)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAsUlEQVR4Xu3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8GXHmAAEdo+NeAAAAAElFTkSuQmCC>