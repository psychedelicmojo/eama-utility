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
* **Performance:** The application must efficiently handle MBOX files up to 1GB in size without significant UI lag during loading, filtering, or sorting.  
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
| **F-DS.402** | Header Visibility Control | The user MUST be able to toggle the visibility of individual or groups of headers (e.g., disable all Received headers). User preferences MUST be saved to Firestore (R-NF.701). |

#### **3.1.5. Header Comparison and Editing**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-CMP.500** | Multi-Email Comparison View | Allow the user to select 2 to 4 emails and display their full headers side-by-side. Default displayed headers include: From, To, Subject, Date, Message-ID, In-Reply-To, References, and all Received headers. |
| **F-CMP.501** | Value Alignment | In the comparison view, header fields must be aligned vertically, showing corresponding values directly next to each other for easy comparison. |
| **F-CMP.502** | Temporary Header Editing | The user MUST be able to edit the value of a header field in the detailed or comparison view. This edit is TEMPORARY and applies only to the in-memory data model and is applied during MBOX export. |

#### **3.1.6. Data Management and Export**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **F-MGMT.600** | Favorites System | The user MUST be able to mark or unmark any email as a favorite. This state MUST be saved per email UID using Firestore (R-NF.701). |
| **F-MGMT.601** | Export Selection | The user MUST be able to select individual emails, a filtered batch of emails, or all loaded emails for export. |
| **F-MGMT.602** | MBOX Export Generation | Generate a valid MBOX file containing the selected emails. The export MUST incorporate any **temporary header edits** made by the user (F-CMP.502) to the in-memory copy. |
| **F-MGMT.603** | Download Capability | Provide a mechanism for the user to download the newly generated MBOX file to their local machine. |
| **F-MGMT.604** | Notes/Comments | The user MUST be able to add, edit, and save a persistent text note or comment associated with each email UID (saved to Firestore, R-NF.701). |

### **3.2. Non-Functional Requirements**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| **R-NF.700** | Usability & Readability | The interface MUST employ a clean, high-contrast design (Tailwind CSS) focusing on readability, especially in the comparison view where header names and values must be clearly separated and aligned. |
| **R-NF.701** | Persistence | User preferences (disabled headers), the favorites list, and email notes/comments (F-MGMT.604) MUST be persistently stored using Firestore under the path /artifacts/{appId}/users/{userId}/eama\_preferences. |
| **R-NF.702** | Standards Compliance | All generated MBOX files MUST be strictly compliant with the MBOX format, including proper From line escaping, ensuring compatibility with standard parsers like Python's mailbox library. |
| **R-NF.703** | Error Handling | The application MUST provide clear, non-intrusive error feedback for parsing errors, invalid file formats, and failed Firestore operations (e.g., using a message box instead of alert). |
| **R-NF.704** | Encoding Robustness | The parser MUST handle emails using robust **UTF-8** detection and correctly process various EOL characters (CRLF, LF) and correctly handle non-standard characters during header parsing to maximize accuracy and field identification. |

