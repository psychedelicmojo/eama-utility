## **Software Requirements Specification (SRS)**

## **Email Analysis and Management Utility (EAMA) v1.0**

---

### **1\. Introduction**

#### **1.1. Purpose**

The purpose of the Email Analysis and Management Utility (EAMA) is to provide developers, system administrators, and security analysts with a standalone, client-side web application for email archiving and deep technical analysis.

The utility serves two primary functions:

1. **Email Fetching & Archiving:** Fetching emails from a user-authenticated Gmail account via the Gmail API and compiling them into a standards-compliant MBOX file for local archival or analysis.  
2. **MBOX Analysis:** Loading local MBOX files for detailed analysis, with a strong focus on searching for and comparing email headers to troubleshoot technical issues like email delivery delays, authentication failures, or routing problems.

#### **1.2. Scope**

EAMA is a serverless application that runs entirely in the user's browser. All data processing and storage happens locally on the user's machine.

The application will provide the following core features:

* **Gmail API Ingestion:** Securely connect to a user's Gmail account to fetch and download emails as an MBOX file based on a specified search query.  
* **Local MBOX Ingestion:** Load one or more local MBOX files for analysis within the application.  
* **Advanced Search & Analysis:** Perform searches on loaded emails and compile a "working set" of relevant messages from multiple search queries for focused analysis.  
* **Header Comparison:** Provide a side-by-side comparison view for 2-4 emails, optimized for spotting differences in technical headers.  
* **Local Data Persistence:** Allow users to add notes and mark favorites, with all metadata stored persistently in the browser's IndexedDB, scoped to the specific MBOX file being analyzed.  
* **Metadata Sharing:** Enable the export and import of analysis metadata (notes and favorites) via a JSON file.

The scope explicitly **excludes** any server-side data storage, multi-user collaboration features, real-time synchronization, or acting as a primary mail client.

#### **1.3. Revision History**

| Version | Date | Author | Description |
| :---- | :---- | :---- | :---- |
| 0.1 | (Pre-Git) | D. Tom | Initial draft focused on core features and MBOX standards. |
| 0.2 | (Pre-Git) | D. Tom | Major refactoring of requirements into a more granular, testable format. |
| 1.0 | 2025-10-03 | Gemini | Complete rewrite to define EAMA as a purely client-side, serverless developer utility. Removed all cloud/multi-user backend requirements. Added Gmail API fetching and an advanced local analysis workflow with file-specific persistent metadata. |

#### 

#### **1.4. Definitions, Acronyms, and Abbreviations**

| Term | Definition |
| :---- | :---- |
| **EAMA** | Email Analysis and Management Utility |
| **MBOX** | Standard file format for storing collections of email messages. |
| **RFC 5322** | Internet Message Format standard (defines email headers). |
| **Header** | Metadata fields of an email (e.g., Date, From, To, Subject, Received). |
| **OAuth 2.0 (PKCE)** | Authorization framework for delegated access. Proof Key for Code Exchange (PKCE) is a security extension for public clients like browser-based applications. |
| **IndexedDB** | A low-level API for client-side storage of significant amounts of structured data, including files/blobs. Used for local persistence. |
| **Working Set** | A user-curated list of emails, assembled from various search results, intended for focused comparison and analysis. |

---

### **2\. Overall Description**

#### **2.1. Product Perspective**

EAMA is a standalone, **serverless web application** (HTML/CSS/JS) designed for maximum privacy and portability. It runs entirely within the user's web browser. All email data from loaded MBOX files and user-generated metadata (notes, favorites) are processed and stored locally on the user's machine using browser technologies like IndexedDB. No email content or PII is ever transmitted to an external server.

#### **2.2. User Characteristics**

The target user has a moderate to high level of technical proficiency, such as a systems administrator, developer, or security analyst, who requires detailed inspection and comparison of email headers for debugging, forensics, or compliance checks.

#### **2.3. General Constraints**

* **Standards Compliance:** MBOX file generation MUST adhere strictly to MBOX format specifications. Header parsing MUST comply with RFC 5322\.  
* **Security:** All data processing is performed client-side. Communication with the Gmail API must be secured using the OAuth 2.0 (PKCE) flow.  
* **Privacy:** As the application handles potentially sensitive email data, file contents are never uploaded to a server. All data remains on the local machine.

---

### **3\. Specific Requirements**

#### **3.1. Functional Requirements**

##### **3.1.1. Data Ingestion (Gmail API)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-GMAIL.100** | Google Account Authentication | The user MUST be able to authenticate with their Google account using a secure, client-side OAuth 2.0 Authorization Code Flow with PKCE. |
| **F-GMAIL.101** | Gmail Search Query | The user MUST be able to provide a full Gmail search query (e.g., from:user@example.com is:unread) to specify which emails to fetch. |
| **F-GMAIL.102** | Batch Fetching & Feedback | The application MUST handle fetching batches of up to 1,000-2,000 emails. It MUST provide clear UI feedback, such as a progress bar, during the fetch operation. |
| **F-GMAIL.103** | MBOX File Compilation | The fetched emails MUST be compiled into a single, downloadable, standards-compliant MBOX file. |

##### **3.1.2. Data Ingestion (Local MBOX)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-IN.200** | Manual MBOX File Upload | The user MUST be able to select and upload one or more local MBOX files for analysis. |
| **F-IN.201** | External MBOX Sources | MBOX files produced by external tools, such as Google Takeout or Google App Scripts, MUST be treated as manually uploaded local files. The EAMA application does not directly integrate with Google App Script. |

##### **3.1.3. Search and Analysis Workflow**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-SRCH.300** | Email Search | The user MUST be able to perform searches on the loaded emails across headers and body content. |
| **F-SRCH.301** | Working Set Management | The user MUST be able to create and manage a "working set," which acts as a temporary collection or comparison list. |
| **F-SRCH.302** | Add to Working Set | The user MUST be able to run multiple, independent searches and add selected emails from the results of each search to the single working set. |

##### **3.1.4. Header Comparison**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-CMP.400** | Side-by-Side Comparison View | From the working set, the user MUST be able to select between 2 and 4 emails to view in a side-by-side comparison view. |
| **F-CMP.401** | Optimized Header Comparison | The comparison view MUST be optimized for easily comparing specific email headers (e.g., all Received headers) across the selected emails to spot differences and trace email paths. |

##### **3.1.5. Local Data Persistence and Sharing**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-META.500** | Favorites and Notes | The user MUST be able to mark emails as "favorites" and add persistent text notes to any email within a loaded MBOX file. |
| **F-META.501** | Local IndexedDB Persistence | All user-generated metadata (notes, favorites) MUST be stored persistently on the user's local machine using IndexedDB. The data MUST NOT be lost when the browser is closed. |
| **F-META.502** | File-Specific Metadata | Stored metadata MUST be file-specific. When a user re-opens an MBOX file they have previously analyzed, their notes and favorites for that specific file MUST automatically reload. |
| **F-META.503** | Metadata Export | The application MUST provide functionality to export all locally stored notes and favorites for the current MBOX file into a single JSON file. |
| **F-META.504** | Metadata Import | The application MUST provide functionality to import a previously exported JSON metadata file, enabling the sharing of analysis with other EAMA users. |

---

### **4\. Security & Privacy Requirements**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-SEC.800** | Client-Side Data Handling | All email data from MBOX files is processed exclusively within the client's browser. No PII from email content is ever transmitted to an external server. |
| **R-SEC.801** | Secure OAuth 2.0 Flow | Authentication with the Gmail API MUST use the OAuth 2.0 Authorization Code Flow with PKCE to ensure that authorization codes cannot be intercepted. |
| **R-SEC.802** | Secure Token Management | OAuth access tokens obtained for the Gmail API MUST be stored in-memory for the duration of the browser session only. They MUST NOT be persisted to localStorage, IndexedDB, or any other permanent client-side storage. |
| **R-SEC.803** | Input Sanitization | Email bodies and headers MUST be sanitized before rendering in the UI to prevent cross-site scripting (XSS) attacks. A whitelisting HTML sanitizer should be used. |

