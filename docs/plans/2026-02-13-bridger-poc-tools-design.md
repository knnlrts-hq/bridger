# Bridger API POC Tools — Design Document

## Interactive HTML Tools for Demoing Bridger XG5 Integration with a Payment Factory

**Version:** 1.0
**Date:** 2026-02-13
**Status:** Implementation

---

## 1. Purpose

Build a set of single-file HTML/JS/CSS tools that demonstrate end-to-end integration between a corporate payment factory (processing ISO 20022 pain.001.001.03 files) and the LexisNexis Bridger Insight XG5 sanctions screening platform. All Bridger API endpoints and webhooks are mocked in-browser — no backend required. Hosted on GitHub Pages.

### What This Proves

1. pain.001.001.03 XML can be parsed in-browser and parties extracted for screening
2. The Bridger XG5 REST API structure (Token, Lists/Search, Results) maps cleanly to payment factory workflows
3. Configurable thresholds drive automatic ACCEPT/REJECT/SUSPECT decisions matching Trax inventory codes
4. Bridger webhooks (AlertStateClosed, AlertDecisionApplied) with HMAC-SHA256 signatures enable async compliance officer decisions
5. The full loop — payment → screening → alert → decision → status update — works end-to-end

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    GitHub Pages (Static)                     │
│                                                              │
│  index.html ─── Landing page with links to all tools         │
│                                                              │
│  Shared modules (loaded by all tools):                       │
│  ├── mock-bridger-server.js  ─── In-memory mock API engine   │
│  └── sample-data.js          ─── Sample XML + mock entities  │
│                                                              │
│  Tools (each a single .html file):                           │
│  ├── 01-pain001-parser.html     ─── XML parser & viewer      │
│  ├── 02-api-explorer.html       ─── Interactive API explorer  │
│  ├── 03-screening-flow.html     ─── E2E screening pipeline   │
│  ├── 04-webhook-simulator.html  ─── Webhook sign & verify     │
│  └── 05-compliance-dashboard.html ── Alert review console     │
└────────────────────────────────────────────────────────────┘
```

All tools load `mock-bridger-server.js` and `sample-data.js` via `<script>` tags. The mock server intercepts nothing — tools call its functions directly (e.g., `MockBridger.search(request)`). No service workers, no fetch interception. Simple function calls that return realistic response objects.

---

## 3. Shared Module: mock-bridger-server.js

### 3.1 State

```javascript
{
  tokens: Map<string, { token, expiresAt }>,
  runs: Map<number, RunInfo>,
  records: Map<number, RecordInfo>,
  webhookConfig: { secret, url, enabled },
  nextRunId: 100001,
  nextResultId: 200001
}
```

### 3.2 API Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| `tokenIssue(clientId, userId, password)` | Auth credentials | `{ access_token, token_type, expires_in }` |
| `listsSearch(searchRequest)` | EntitySearchRequest | `{ SearchResults: { Records: [...] } }` |
| `listsDataFiles()` | none | `{ DataFiles: [...] }` |
| `resultsSearchRecords(criteria)` | Search criteria | `{ Records: [...] }` |
| `resultsSetRecordState(resultId, state)` | ID + RecordState | `{ Success: true }` |
| `resultsRecord(resultId)` | Single ID | Full record detail |
| `generateWebhookPayload(resultId, eventType)` | ID + event | `{ payload, headers }` |
| `validateWebhookSignature(payload, headers, secret)` | Verify HMAC | `{ valid, details }` |

### 3.3 Match Logic

The mock uses a built-in "watchlist" of ~20 names/entities. When a search is submitted, it fuzzy-matches input entity names against the watchlist using a simple bigram similarity score (0–100). This produces realistic match scores without external dependencies.

**Built-in watchlist entries** (fictional, based on realistic patterns):
- Individuals: names resembling common sanctions list patterns
- Businesses: shell company names, trade entities
- Each entry has: listName (OFAC SDN, EU Sanctions, UN Consolidated), entityType, reasonListed, dateListed

### 3.4 HMAC-SHA256 Webhook Signing

Implements the exact Bridger signature algorithm:
1. SHA256 hash the payload body → base64 → `x-ms-content-sha256`
2. Build `StringThatIsSigned = "POST\n{path}\n{date};{host};{contentHash}"`
3. HMAC-SHA256 with secret → base64 → `Signature` field in `Authorization` header

Uses the Web Crypto API (SubtleCrypto) — no external crypto libraries needed.

---

## 4. Shared Module: sample-data.js

### 4.1 Sample pain.001.001.03 Files

Three sample XML files with increasing complexity:

1. **Simple (3 payments)**: Clean names, should all pass screening
2. **Mixed (5 payments)**: 2 clean, 2 suspicious (close matches), 1 definite hit
3. **Batch (10 payments)**: Realistic batch with various match levels

Each XML follows the `urn:iso:std:iso:20022:tech:xsd:pain.001.001.03` namespace with:
- `GrpHdr` (MessageIdentification, CreationDateTime, NumberOfTransactions, ControlSum, InitiatingParty)
- `PmtInf` blocks with `Dbtr`, `DbtrAcct`, `DbtrAgt`
- `CdtTrfTxInf` entries with `Cdtr`, `CdtrAcct`, `CdtrAgt`, `RmtInf`

### 4.2 Mock Watchlist

~20 entries across multiple lists:

| List | Sample Entries | Type |
|------|---------------|------|
| OFAC SDN | Ahmad Trading Corp, Petrov Holdings Ltd | Business |
| OFAC SDN | Mikhail Petrov, Hassan Al-Rahman | Individual |
| EU Consolidated | EuroTrade Sanctions GmbH, Volkov Industries | Business |
| UN Consolidated | Global Arms Ltd, Desert Logistics LLC | Business |
| PEP Database | Viktor Volkov, Carlos Mendez-Silva | Individual |

---

## 5. Tool Specifications

### 5.1 Tool 1: pain.001 Parser & Viewer (`01-pain001-parser.html`)

**Purpose**: Upload/paste pain.001.001.03 XML → see structured payment data with all screenable parties highlighted.

**Features**:
- Textarea for pasting XML + file upload button
- "Load Sample" dropdown (3 sample files)
- Parsed view shows:
  - Group header summary (msg ID, creation date, number of txns, control sum)
  - For each PmtInf block: debtor info, payment method, requested execution date
  - For each CdtTrfTxInf: creditor info, amount, currency, remittance info
  - All parties extracted into a "Screenable Parties" summary table
- Color-coded party types (debtor=blue, creditor=green, ultimate parties=amber)
- "Send to Screening" button → saves parsed data to sessionStorage and navigates to Tool 3

**Dependencies**: None (vanilla DOM parsing with DOMParser)

### 5.2 Tool 2: Bridger API Explorer (`02-api-explorer.html`)

**Purpose**: Manually construct and execute Bridger XG5 API calls against the mock server. Learn the API shape.

**Features**:
- Tabbed interface: Token | Search | Results | ListMaintenance
- **Token tab**: Enter clientId/userId/password → Issue → see JWT response
- **Search tab**: Build an EntitySearchRequest with:
  - ClientContext fields
  - Configuration (PredefinedSearchName, WriteResultsToDatabase, AssignResultTo)
  - Input records (add/remove entities with Name, Addresses, IDs)
  - Pre-fill from sample entities
  - Execute → see full SearchResults response with expandable match details
- **Results tab**: SearchRecords by criteria, view individual Record, SetRecordState
- **ListMaintenance tab**: View available DataFiles/lists
- Request/response shown as formatted JSON with syntax highlighting
- Copy-to-clipboard for all payloads

**Dependencies**: None (JSON syntax highlighting via simple regex-based formatter)

### 5.3 Tool 3: Screening Flow Simulator (`03-screening-flow.html`)

**Purpose**: The main demo — end-to-end payment screening pipeline with visual timeline.

**Features**:
- Load pain.001 (paste, upload, or sample)
- Configure thresholds: auto-accept (default <30), review (30-89), auto-reject (>=90)
- "Run Screening" button triggers the full pipeline:
  1. Parse XML → extract parties
  2. Authenticate (Token/Issue)
  3. Build search requests (one per payment, batched)
  4. Execute searches (Lists/Search)
  5. Apply threshold rules
  6. Assign Trax statuses
- Visual pipeline with animated steps (parse → auth → screen → decide → status)
- Results table showing each payment with:
  - Payment ref, debtor, creditor, amount
  - Highest match score, matching list
  - Assigned Trax status (color-coded: green=ACCEPTED, red=REJECTED, amber=SUSPECT)
  - Expandable match details
- Summary statistics: X accepted, Y rejected, Z suspect
- "Review Suspects" button → navigates to Tool 5

**Dependencies**: None

### 5.4 Tool 4: Webhook Simulator (`04-webhook-simulator.html`)

**Purpose**: Demonstrate Bridger webhook signing and verification. Two-panel view.

**Features**:
- **Left panel (Bridger side — "Send Webhook")**:
  - Select event type: AlertStateClosed or AlertDecisionApplied
  - Fill in payload fields (ResultId, Status, State, DecisionTags, etc.)
  - Pre-fill from existing mock records
  - Configure: webhook URL path, secret
  - "Sign & Send" button:
    - Shows step-by-step HMAC computation (SHA256 content hash → StringThatIsSigned → HMAC-SHA256)
    - Displays all three headers: x-ms-date, x-ms-content-sha256, Authorization
    - Sends to right panel

- **Right panel (Bank Connector side — "Receive Webhook")**:
  - Shows incoming headers + payload
  - Step-by-step signature verification (recomputes, compares)
  - Green/red validation result
  - If valid: maps EventType + Status to Trax payment status transition
  - Shows decision mapping logic
  - Audit log of all received webhooks

- **Tamper mode**: Edit payload after signing → re-verify → shows signature mismatch

**Dependencies**: Web Crypto API (built-in)

### 5.5 Tool 5: Compliance Review Dashboard (`05-compliance-dashboard.html`)

**Purpose**: Compliance officer workflow for reviewing SUSPECT alerts.

**Features**:
- Shows all payments in EXTERNAL_SUSPECT status (from mock state)
- "Load Sample Scenario" button to populate with realistic data
- For each suspect payment:
  - Payment details (ref, amount, debtor, creditor)
  - Match details: list name, match score, entity name on list, reason listed, date listed
  - Side-by-side comparison: payment party vs. list entity
- Decision actions per alert:
  - "Accept (False Positive)" → updates via SetRecordState → triggers AlertDecisionApplied webhook → status becomes EXTERNAL_ACCEPTED
  - "Reject (True Match)" → blocks payment → EXTERNAL_REJECTED
  - "Escalate" → reassigns to senior reviewer
  - Add note (free text)
- Real-time status updates in the table
- Decision audit trail at bottom
- Webhook event log showing the AlertDecisionApplied payloads generated

**Dependencies**: None

---

## 6. UI Design

### 6.1 Shared Style

All tools share a consistent visual style:
- **Font**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- **Color palette**:
  - Primary: `#1a56db` (corporate blue)
  - Success/Accepted: `#059669` (green)
  - Danger/Rejected: `#dc2626` (red)
  - Warning/Suspect: `#d97706` (amber)
  - Background: `#f8fafc`
  - Surface: `#ffffff`
  - Border: `#e2e8f0`
- **Layout**: Max-width 1200px, centered, responsive
- **Cards**: White background, subtle shadow, rounded corners
- **Code blocks**: Monospace, dark background (#1e293b), syntax-colored JSON

### 6.2 Navigation

Each tool includes a top nav bar with:
- "Bridger POC" logo/title
- Links to all 5 tools
- Current tool highlighted

---

## 7. Hosting

### 7.1 GitHub Pages

- All files live in `/poc/` directory
- `index.html` at `/poc/index.html` serves as the landing page
- No build step — all files are served as-is
- GitHub Pages configured to serve from the branch root or `/poc/` path

### 7.2 File Structure

```
poc/
├── index.html
├── mock-bridger-server.js
├── sample-data.js
├── 01-pain001-parser.html
├── 02-api-explorer.html
├── 03-screening-flow.html
├── 04-webhook-simulator.html
└── 05-compliance-dashboard.html
```

---

## 8. Non-Goals

- No real Bridger API connectivity (everything mocked)
- No persistent storage (all state is in-memory, resets on page reload)
- No authentication/authorization for the tools themselves
- No mobile-optimized layouts (desktop demo only)
- No server-side components
- No React, Vue, or framework dependencies
