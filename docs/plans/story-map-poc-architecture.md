# Bridger Integration — Story Map: POC to Production Architecture

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Draft

---

## Overview

This story map defines the journey from the current Bridger XG5 POC (five interactive HTML demo tools) to a production-ready integration within the Trax Payment Hub and Bank Connector ecosystem. It is organized into **9 epics** spanning **27 user stories**, ordered by delivery priority from left to right.

### How to Read This Map

```
 ──────────────────────────────────────────────────────────────────────────────
  BACKBONE (Epics)     Left = Higher Priority ──────────► Right = Lower Priority
 ──────────────────────────────────────────────────────────────────────────────
  │ Epic 1         │ Epic 2         │ Epic 3         │  ...  │ Epic 9         │
  ├────────────────┼────────────────┼────────────────┤       ├────────────────┤
  │ Story 1.1      │ Story 2.1      │ Story 3.1      │       │ Story 9.1      │
  │ Story 1.2      │ Story 2.2      │ Story 3.2      │       │ Story 9.2      │
  │ Story 1.3      │ Story 2.3      │ Story 3.3      │       │ Story 9.3      │
  │ (top = must)   │                │                │       │                │
  │ (bottom = nice) │               │                │       │                │
 ──────────────────────────────────────────────────────────────────────────────
  Within each epic, stories are ranked top-to-bottom by necessity:
    Top    = Must-have (MVP)
    Middle = Should-have
    Bottom = Nice-to-have
```

### Delivery Phases

| Phase | Epics | Goal |
|-------|-------|------|
| **Phase 1 — Foundation** | 1, 2 | Core API client and payment parsing |
| **Phase 2 — Screening Pipeline** | 3, 4 | End-to-end screening with threshold decisioning |
| **Phase 3 — Async Workflows** | 5, 6 | Webhook receiver and compliance officer tools |
| **Phase 4 — Hardening** | 7, 8, 9 | Resilience, observability, and multi-provider extensibility |

---

## Epic 1 — Bridger API Client

> Build a production-grade REST client for the LexisNexis Bridger XG5 API that handles authentication, request construction, and response parsing.

**Why first:** Every other epic depends on reliable API communication with Bridger.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 1 — Bridger API Client                                │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 1.1 Token Service │  Authenticate & cache JWT tokens     │
│  │     [Must-have]   │  with auto-refresh before expiry     │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 1.2 Search Client │  Build & send EntitySearchRequest    │
│  │     [Must-have]   │  payloads to POST /api/Lists/Search  │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 1.3 Results Client│  Manage alerts via Results interface  │
│  │     [Should-have] │  (Record, SetRecordState, SearchRuns)│
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 1.1 — Token Service

**As a** Bank Connector service,
**I want** to obtain and cache Bridger XG5 JWT tokens with automatic refresh,
**so that** all downstream API calls are authenticated without per-request token overhead.

**Acceptance Criteria:**
- Calls `POST /api/Token/Issue` with client credentials
- Caches token in memory with TTL derived from `expires_in`
- Auto-refreshes token 60 seconds before expiry
- Thread-safe for concurrent API calls
- Logs token acquisition and refresh events (no secrets in logs)

**Technical Notes:**
- Credentials stored in environment variables or secrets manager
- Token refresh uses a mutex/lock to prevent thundering herd on expiry

---

### Story 1.2 — Search Client

**As a** Bank Connector service,
**I want** to construct and send screening requests to the Bridger Search API,
**so that** payment entities can be screened against configured sanctions lists.

**Acceptance Criteria:**
- Builds `EntitySearchRequest` from normalized entity data
- Supports `PredefinedSearchName` for selecting list profiles
- Configurable `WriteResultsToDatabase` flag (true for production, false for dry-run)
- Parses `SearchResults` response into structured match records with scores
- Handles HTTP 4xx/5xx with appropriate error types

**Technical Notes:**
- Request payload schema defined in `docs/bridger-api-webhooks-guide.md`
- Entity types: Individual (type=1) and Business (type=2)

---

### Story 1.3 — Results Client

**As a** compliance officer,
**I want** the system to manage stored alerts through the Results API,
**so that** screening decisions are persisted and auditable in Bridger's database.

**Acceptance Criteria:**
- Retrieves alert details via `GET /api/Results/Record/{id}`
- Updates alert state via `POST /api/Results/SetRecordState`
- Searches historical runs via `POST /api/Results/SearchRuns`
- Maps Bridger alert states (Open, Closed, Escalated) to internal domain types

---

## Epic 2 — Payment Message Parsing

> Parse ISO 20022 pain.001 payment initiation messages to extract screenable entities, and generate pain.002 status reports reflecting screening outcomes.

**Why second:** Screening requires structured entity data from payment messages.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 2 — Payment Message Parsing                           │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 2.1 pain.001      │  Parse XML → extract debtors,       │
│  │   Parser          │  creditors, ultimate parties         │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 2.2 Entity        │  Transform ISO 20022 party data      │
│  │   Mapper          │  into Bridger EntitySearchRequest     │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 2.3 pain.002      │  Generate Payment Status Report      │
│  │   Generator       │  from screening decisions             │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 2.1 — pain.001 Parser

**As a** Trax Payment Hub,
**I want** to parse incoming pain.001.001.03 XML messages,
**so that** I can extract all parties (debtor, creditor, ultimate creditor) for screening.

**Acceptance Criteria:**
- Parses `CstmrCdtTrfInitn` root element
- Extracts `GrpHdr` (MsgId, CreDtTm, NbOfTxs, CtrlSum)
- Extracts per-transaction: `Dbtr`, `Cdtr`, `UltmtCdtr` with names, addresses, and account IDs
- Handles single and batch payment files (multiple `CdtTrfTxInf` blocks)
- Validates XML against pain.001.001.03 schema; rejects malformed input with clear errors

**Technical Notes:**
- Reference: existing `poc/01-pain001-parser.html` for field mapping
- Postal address fields: StreetName, BuildingNumber, PostCode, TownName, Country

---

### Story 2.2 — Entity Mapper

**As a** Bank Connector service,
**I want** to transform parsed pain.001 party data into Bridger entity search requests,
**so that** each party is screened in the format Bridger expects.

**Acceptance Criteria:**
- Maps party name → `Entity.Name.Full`
- Maps postal address → `Entity.Addresses[0]` (Street, City, PostalCode, Country)
- Maps IBAN → `Entity.IDs[].Number` with type `IBAN`
- Sets `Entity.EntityType` to 2 (Business) by default; 1 (Individual) when party name matches person-name heuristics
- Preserves original payment reference (`EndToEndId`) as correlation ID

**Field Mapping Reference:**

| ISO 20022 Field | Bridger Entity Field | Notes |
|-----------------|---------------------|-------|
| `Dbtr/Nm` | `Entity.Name.Full` | Debtor name |
| `Dbtr/PstlAdr/StrtNm` | `Entity.Addresses[0].Street1` | Street |
| `Dbtr/PstlAdr/TwnNm` | `Entity.Addresses[0].City` | City |
| `Dbtr/PstlAdr/PstCd` | `Entity.Addresses[0].PostalCode` | Postal code |
| `Dbtr/PstlAdr/Ctry` | `Entity.Addresses[0].Country` | ISO country |
| `CdtrAcct/Id/IBAN` | `Entity.IDs[0].Number` | Account |

---

### Story 2.3 — pain.002 Generator

**As a** Trax Payment Hub,
**I want** to generate pain.002.001.03 Payment Status Report messages from screening decisions,
**so that** upstream systems (ERP) receive standardized feedback on payment status.

**Acceptance Criteria:**
- Generates valid pain.002.001.03 XML
- Maps screening outcomes to ISO 20022 status codes:

| Screening Decision | `TxSts` | `StsRsnInf/Rsn/Cd` | Meaning |
|-------------------|---------|---------------------|---------|
| Auto-Release | `ACCP` | — | Accepted (no sanctions match) |
| Auto-Block | `RJCT` | `NAUT` | Rejected — Not Authorised (sanctions) |
| Hold for Review | `PDNG` | `COMP` | Pending — Compliance review required |

- Includes original `MsgId` and `EndToEndId` for correlation
- Validates generated XML before returning

---

## Epic 3 — Screening Pipeline Orchestrator

> Orchestrate the end-to-end screening flow: receive payment, extract entities, screen against Bridger, apply threshold logic, and route the decision.

**Why third:** Connects Epics 1 and 2 into a working pipeline.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 3 — Screening Pipeline Orchestrator                   │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 3.1 Pipeline      │  Coordinate parse → screen →        │
│  │   Orchestrator    │  decide → respond flow               │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 3.2 Threshold     │  Apply score-based auto-accept /     │
│  │   Engine          │  auto-reject / escalate rules        │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 3.3 Transaction   │  Persist screening state per         │
│  │   State Manager   │  transaction for audit & webhooks    │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 3.1 — Pipeline Orchestrator

**As a** Bank Connector service,
**I want** a pipeline that coordinates the full screening flow for each payment,
**so that** payments are automatically screened before release.

**Acceptance Criteria:**
- Receives pain.001 message (or pre-parsed payment data)
- Calls pain.001 parser → entity mapper → Bridger search client → threshold engine
- Returns screening result with decision and pain.002 response
- Handles partial failures (e.g., one creditor screen fails, others succeed)
- Processes batch payments: screens all parties, aggregates to worst-case decision
- Execution is idempotent per `MsgId` + `EndToEndId`

**Pipeline Flow:**

```
  pain.001 XML
       │
       ▼
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ Parser   │────▶│ Mapper   │────▶│ Bridger  │────▶│ Threshold│
  │ (2.1)    │     │ (2.2)    │     │ Search   │     │ Engine   │
  │          │     │          │     │ (1.2)    │     │ (3.2)    │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                           │
                                                           ▼
                                                     ┌──────────┐
                                                     │ pain.002 │
                                                     │ Generator│
                                                     │ (2.3)    │
                                                     └──────────┘
```

---

### Story 3.2 — Threshold Engine

**As a** compliance team,
**I want** configurable threshold rules that auto-decide payment outcomes based on match scores,
**so that** only ambiguous cases require manual review while clear matches/misses are handled automatically.

**Acceptance Criteria:**
- Configurable threshold boundaries (default: accept < 30, review 30–89, reject >= 90)
- Per-entity scoring: takes highest match score across all list hits
- Per-transaction scoring: takes worst-case across all screened parties
- Returns structured decision: `ACCEPT`, `REJECT`, or `REVIEW` with score breakdown
- Thresholds configurable per client/payment-type without code changes (config-driven)

**Decision Matrix:**

```
  Score: 0 ─────────── 30 ─────────── 90 ─────────── 100
         │  AUTO-ACCEPT  │  MANUAL REVIEW │  AUTO-REJECT  │
         │  → ACCP       │  → PDNG        │  → RJCT       │
         │  (release)    │  (hold)        │  (block)      │
```

---

### Story 3.3 — Transaction State Manager

**As a** Bank Connector service,
**I want** to persist the screening state of each transaction,
**so that** async webhook decisions can be correlated back and the full audit trail is preserved.

**Acceptance Criteria:**
- Stores per-transaction: MsgId, EndToEndId, screening timestamp, decision, score, Bridger run ID
- State transitions: `PENDING_SCREENING` → `SCREENED` → `ACCEPTED` | `REJECTED` | `REVIEW_PENDING` → `REVIEW_DECIDED`
- Supports lookup by MsgId+EndToEndId (for webhook correlation) and by Bridger alert ID
- Immutable audit log of all state transitions with timestamps

**State Machine:**

```
  ┌───────────────────┐
  │ PENDING_SCREENING │
  └────────┬──────────┘
           │ screening complete
           ▼
  ┌───────────────┐
  │   SCREENED    │
  └───┬─────┬─────┘──────────┐
      │     │                │
      ▼     ▼                ▼
 ┌────────┐ ┌────────┐ ┌──────────────┐
 │ACCEPTED│ │REJECTED│ │REVIEW_PENDING│
 └────────┘ └────────┘ └──────┬───────┘
                               │ compliance decision
                               ▼
                        ┌──────────────┐
                        │REVIEW_DECIDED│
                        │ (accept/     │
                        │  reject)     │
                        └──────────────┘
```

---

## Epic 4 — Trax Integration Layer

> Integrate the screening pipeline into the Trax Payment Hub's existing payment processing flow, ensuring screening happens at the correct point in the payment lifecycle.

**Why fourth:** Connects the standalone pipeline to the real payment processing system.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 4 — Trax Integration Layer                            │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 4.1 Payment       │  Hook screening into Trax payment    │
│  │   Lifecycle Hook  │  state machine at EXTERNAL_CHECK     │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 4.2 Status        │  Map Bridger decisions back into     │
│  │   Synchronization │  Trax status codes                   │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 4.3 Batch         │  Handle bulk pain.001 files with     │
│  │   Processing      │  parallel screening & aggregation    │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 4.1 — Payment Lifecycle Hook

**As a** Trax Payment Hub,
**I want** to invoke the screening pipeline at the `EXTERNAL_CHECK` stage of the payment lifecycle,
**so that** every outgoing payment is screened before release without changing the existing flow.

**Acceptance Criteria:**
- Intercepts payment at `EXTERNAL_CHECK` state transition
- Calls Bank Connector screening pipeline with parsed payment data
- Blocks payment progression until screening completes (sync for auto-decisions)
- Parks payment for async resolution when decision is `REVIEW`
- Timeout handling: if screening exceeds SLA, payment enters `EXTERNAL_TIMEOUT` state

---

### Story 4.2 — Status Synchronization

**As a** Trax Payment Hub,
**I want** screening decisions mapped to Trax-native status codes,
**so that** downstream processing and reporting use consistent terminology.

**Acceptance Criteria:**
- Maps screening decisions to Trax statuses:

| Screening Decision | Trax Status | Description |
|-------------------|-------------|-------------|
| `ACCEPT` | `EXTERNAL_ACCEPTED` | Payment cleared, proceed to release |
| `REJECT` | `EXTERNAL_REJECTED` | Payment blocked, sanctions match |
| `REVIEW` | `EXTERNAL_SUSPECT` | Held for compliance officer review |
| Timeout | `EXTERNAL_TIMEOUT` | Screening SLA breached |
| Error | `EXTERNAL_ERROR` | Screening failed, requires retry/manual |

- Updates Trax payment record atomically with status + screening metadata
- Emits Trax events for downstream listeners (audit, notifications)

---

### Story 4.3 — Batch Processing

**As a** Trax Payment Hub,
**I want** to process multi-transaction pain.001 files efficiently,
**so that** batch payment files (100+ transactions) are screened within acceptable time limits.

**Acceptance Criteria:**
- Parses batch pain.001 with N transactions
- Screens entities in parallel (configurable concurrency: default 10)
- Aggregates results: batch succeeds only if all transactions pass
- Single rejected transaction does not block other transactions in the batch
- Reports per-transaction status (not just batch-level)
- Generates single pain.002 with per-transaction status entries

---

## Epic 5 — Webhook Receiver Framework

> Build a generic, provider-agnostic webhook receiver in Bank Connector that validates, routes, and processes inbound webhook events from external compliance providers.

**Why fifth:** Enables async compliance decisions to flow back into the payment lifecycle.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 5 — Webhook Receiver Framework                        │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 5.1 Generic       │  HTTP endpoint with pluggable        │
│  │   Receiver        │  provider routing & validation       │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 5.2 Bridger       │  HMAC-SHA256 signature validation    │
│  │   Event Processor │  and alert state mapping             │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 5.3 Replay        │  Timestamp & nonce checks to         │
│  │   Protection      │  prevent duplicate event processing  │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 5.1 — Generic Webhook Receiver

**As a** Bank Connector service,
**I want** a webhook receiver endpoint that routes events to provider-specific processors,
**so that** we can support multiple compliance providers with a single framework.

**Acceptance Criteria:**
- Single HTTP endpoint: `POST /webhooks/{provider}`
- Routes to registered provider processor based on URL path
- Returns `200 OK` immediately after validation (async processing)
- Returns `401 Unauthorized` for invalid signatures
- Returns `400 Bad Request` for malformed payloads
- Logs all webhook receipts (headers + body hash, not raw secrets)
- Provider registration is plugin-based (add new providers without modifying core)

**Architecture:**

```
  Bridger XG5 ──────┐
                     │  POST /webhooks/bridger
                     ▼
              ┌──────────────┐
              │   Webhook    │
  Column ────▶│   Receiver   │──▶ Provider Router
              │   Endpoint   │         │
  Future ────▶│              │    ┌────┴────┐
              └──────────────┘    │         │
                            ┌─────┴──┐ ┌───┴──────┐
                            │Bridger │ │ Column   │
                            │Processor│ │Processor │
                            └────────┘ └──────────┘
```

---

### Story 5.2 — Bridger Event Processor

**As a** Bank Connector service,
**I want** to validate and process Bridger webhook events (AlertStateClosed, AlertDecisionApplied),
**so that** compliance officer decisions in Bridger are reflected in payment statuses.

**Acceptance Criteria:**
- Validates HMAC-SHA256 signature using Bridger's signing scheme:
  - `x-ms-date`: UTC timestamp
  - `x-ms-content-sha256`: Base64(SHA256(body))
  - `Authorization`: HMAC-SHA256 SignedHeaders=x-ms-date;x-ms-content-sha256
- Processes `AlertStateClosed` events → updates transaction to `ACCEPTED` or `REJECTED`
- Processes `AlertDecisionApplied` events → logs intermediate decisions
- Correlates webhook alert ID to internal transaction via state manager (3.3)
- Triggers Trax status update via integration layer (4.2)

**Bridger Webhook Signature Validation:**

```
  ┌─────────────────────────────────────────────────────┐
  │  1. Extract headers:                                │
  │     x-ms-date, x-ms-content-sha256, Authorization  │
  │                                                     │
  │  2. Compute expected content hash:                  │
  │     Base64(SHA256(request_body))                     │
  │                                                     │
  │  3. Compare with x-ms-content-sha256                │
  │     → reject if mismatch                            │
  │                                                     │
  │  4. Build string-to-sign:                           │
  │     "POST\n/webhooks/bridger\n\n                    │
  │      x-ms-date:{value}\n                            │
  │      x-ms-content-sha256:{value}"                   │
  │                                                     │
  │  5. HMAC-SHA256(secret_key, string_to_sign)         │
  │     → compare with Authorization signature          │
  └─────────────────────────────────────────────────────┘
```

---

### Story 5.3 — Replay Protection

**As a** Bank Connector service,
**I want** to detect and reject replayed or duplicate webhook events,
**so that** the same compliance decision is not applied twice.

**Acceptance Criteria:**
- Checks `x-ms-date` is within acceptable time window (default: 5 minutes)
- Maintains idempotency store keyed by event ID + content hash
- Rejects duplicate events with `200 OK` (idempotent — don't error, just skip)
- Idempotency store has TTL-based expiry (default: 24 hours, matching Bridger retry window)
- Logs duplicate detection events for monitoring

---

## Epic 6 — Compliance Officer Dashboard

> Provide a web-based interface for compliance officers to review, decide on, and audit screening alerts that require manual intervention.

**Why sixth:** Enables human-in-the-loop decisions for `REVIEW` cases.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 6 — Compliance Officer Dashboard                      │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 6.1 Alert Queue   │  View & filter pending REVIEW        │
│  │   View            │  alerts ranked by score & age        │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 6.2 Decision      │  Accept / reject / escalate with     │
│  │   Actions         │  mandatory rationale capture         │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 6.3 Audit Trail   │  Searchable log of all decisions     │
│  │   Viewer          │  with officer attribution            │
│  │   [Nice-to-have]  │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 6.1 — Alert Queue View

**As a** compliance officer,
**I want** to see a prioritized list of pending screening alerts,
**so that** I can focus on the most urgent cases first.

**Acceptance Criteria:**
- Displays all transactions in `REVIEW_PENDING` state
- Sortable by: match score (descending), payment amount, submission time
- Filterable by: date range, score range, debtor/creditor name, payment type
- Shows summary per alert: parties involved, match score, matched list, payment amount, time waiting
- Auto-refreshes at configurable interval (default: 30 seconds)
- Visual indicators for SLA breaches (alerts waiting > configured threshold)

---

### Story 6.2 — Decision Actions

**As a** compliance officer,
**I want** to accept, reject, or escalate a screening alert with a recorded rationale,
**so that** my decision is auditable and the payment can proceed accordingly.

**Acceptance Criteria:**
- Three actions per alert: **Release** (accept), **Block** (reject), **Escalate** (to senior officer)
- Mandatory free-text rationale field (minimum 10 characters)
- Optional: attach supporting documents (PDF, screenshots)
- On decision: updates transaction state manager (3.3), triggers Trax status sync (4.2)
- Also updates Bridger alert state via Results API (1.3) to keep systems in sync
- Confirmation dialog before irreversible actions (block/release)

---

### Story 6.3 — Audit Trail Viewer

**As a** compliance manager,
**I want** to search and review all past screening decisions,
**so that** I can generate compliance reports and respond to regulatory inquiries.

**Acceptance Criteria:**
- Search by: date range, officer name, decision type, entity name, score range
- Displays: original match details, officer decision, rationale, timestamps
- Export to CSV/PDF for regulatory reporting
- Read-only view (no modifications to historical decisions)
- Pagination for large result sets (default: 50 per page)

---

## Epic 7 — Resilience & Error Handling

> Ensure the screening pipeline gracefully handles failures, retries transient errors, and degrades gracefully when external services are unavailable.

**Why seventh:** Production readiness requires fault tolerance.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 7 — Resilience & Error Handling                       │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 7.1 Circuit       │  Protect against Bridger API         │
│  │   Breaker         │  outages with fail-open/closed       │
│  │   [Must-have]     │  configurable behavior               │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 7.2 Retry Policy  │  Exponential backoff with jitter     │
│  │                   │  for transient failures              │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 7.3 Dead Letter   │  Capture failed screenings for       │
│  │   Queue           │  manual reprocessing                 │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 7.1 — Circuit Breaker

**As a** Bank Connector service,
**I want** a circuit breaker around the Bridger API client,
**so that** cascading failures are prevented when Bridger is unavailable.

**Acceptance Criteria:**
- Three states: `CLOSED` (normal), `OPEN` (failing), `HALF_OPEN` (probing)
- Opens after N consecutive failures (configurable, default: 5)
- Half-open after cooldown period (configurable, default: 30 seconds)
- Closes after M successful probes (configurable, default: 2)
- When open: configurable behavior — fail-fast with `EXTERNAL_ERROR` or queue for retry
- Emits state-change events for monitoring/alerting
- Separate circuit breakers per API endpoint (Token, Search, Results)

---

### Story 7.2 — Retry Policy

**As a** Bank Connector service,
**I want** automatic retries with exponential backoff for transient Bridger API errors,
**so that** temporary network issues don't cause payment screening failures.

**Acceptance Criteria:**
- Retries on: HTTP 429, 500, 502, 503, 504, connection timeout, DNS failure
- Does NOT retry on: HTTP 400, 401, 403, 404 (client errors are not transient)
- Exponential backoff: 1s, 2s, 4s with ±25% jitter
- Max retries: configurable (default: 3)
- Total timeout: configurable (default: 30 seconds per screening request)
- Retry attempts logged with correlation ID

---

### Story 7.3 — Dead Letter Queue

**As a** operations team,
**I want** failed screening requests to be captured in a dead letter queue,
**so that** they can be investigated and reprocessed without data loss.

**Acceptance Criteria:**
- Captures screening requests that exhaust all retries
- Stores: original payment data, error details, attempt history, timestamps
- Provides reprocessing mechanism (manual trigger or scheduled sweep)
- Alerts operations team when DLQ depth exceeds threshold
- DLQ entries expire after configurable retention period (default: 30 days)

---

## Epic 8 — Observability & Monitoring

> Instrument the screening pipeline with structured logging, metrics, and tracing to enable real-time monitoring and post-incident analysis.

**Why eighth:** Cannot operate production systems without visibility.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 8 — Observability & Monitoring                        │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 8.1 Structured    │  Correlation IDs, screening          │
│  │   Logging         │  outcomes, latency per step          │
│  │   [Must-have]     │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 8.2 Metrics &     │  Screening volume, latency,          │
│  │   Dashboards      │  error rates, decision distribution  │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 8.3 Alerting      │  Proactive alerts on error spikes,   │
│  │   Rules           │  latency degradation, SLA breaches   │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 8.1 — Structured Logging

**As a** operations team,
**I want** structured, correlation-ID-tagged logs throughout the screening pipeline,
**so that** I can trace any payment's complete screening journey across services.

**Acceptance Criteria:**
- Every log entry includes: correlation ID (MsgId+EndToEndId), timestamp, service, component
- Key events logged: screening start, Bridger API call/response, threshold decision, state transitions
- Sensitive data redacted: party names hashed, account numbers masked (last 4 digits only)
- Log levels: DEBUG (API payloads), INFO (decisions), WARN (retries), ERROR (failures)
- JSON format for machine parsing; human-readable fallback for local dev

---

### Story 8.2 — Metrics & Dashboards

**As a** operations team,
**I want** real-time metrics on screening pipeline health and performance,
**so that** I can detect issues before they impact payments.

**Acceptance Criteria:**
- Key metrics:
  - `screening.requests.total` — counter by decision type (accept/reject/review)
  - `screening.latency.ms` — histogram (p50, p95, p99)
  - `bridger.api.calls.total` — counter by endpoint and HTTP status
  - `bridger.api.latency.ms` — histogram per endpoint
  - `webhook.events.total` — counter by provider and event type
  - `circuit_breaker.state` — gauge per endpoint
  - `dlq.depth` — gauge
- Dashboard showing: throughput, latency distribution, error rate, decision breakdown
- Supports standard metrics backends (Prometheus, CloudWatch, Datadog)

---

### Story 8.3 — Alerting Rules

**As a** operations team,
**I want** proactive alerts when the screening pipeline degrades,
**so that** we can respond before payments are impacted.

**Acceptance Criteria:**
- Alert conditions:
  - Error rate > 5% over 5-minute window
  - p95 latency > 10 seconds over 5-minute window
  - Circuit breaker opens on any endpoint
  - DLQ depth > 10 items
  - Webhook delivery failures > 3 consecutive
  - Pending review alerts exceeding SLA (configurable, default: 4 hours)
- Alert channels: configurable (email, Slack, PagerDuty)
- Alert severity levels: INFO, WARNING, CRITICAL
- Auto-resolve when condition clears

---

## Epic 9 — Multi-Provider Extensibility

> Extend the framework to support additional compliance providers (Column Banking, Dow Jones, Refinitiv) and custom watchlists beyond Bridger XG5.

**Why last:** Core system must work with Bridger first; extensibility is a strategic investment.

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 9 — Multi-Provider Extensibility                      │
│                                                             │
│  ┌───────────────────┐                                      │
│  │ 9.1 Provider      │  Abstract interface for screening    │
│  │   Abstraction     │  providers with common contract      │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 9.2 Column        │  Column Banking Platform webhook     │
│  │   Integration     │  processor for payment status        │
│  │   [Should-have]   │                                      │
│  └───────────────────┘                                      │
│  ┌───────────────────┐                                      │
│  │ 9.3 Custom        │  Support for internal/proprietary    │
│  │   Watchlists      │  screening lists via ListMaintenance │
│  │   [Nice-to-have]  │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Story 9.1 — Provider Abstraction Layer

**As a** Bank Connector architect,
**I want** a common interface for compliance screening providers,
**so that** new providers can be added without modifying the core screening pipeline.

**Acceptance Criteria:**
- Defines `ScreeningProvider` interface with methods: `screen(entities)`, `getAlertStatus(id)`, `updateAlertState(id, decision)`
- Defines `WebhookProcessor` interface with methods: `validateSignature(request)`, `parseEvent(body)`, `processEvent(event)`
- Provider registration via configuration (not code changes)
- Pipeline orchestrator (3.1) is provider-agnostic — delegates to configured provider
- Supports fallback/chain: screen with Provider A, then Provider B if A is unavailable

---

### Story 9.2 — Column Banking Integration

**As a** Bank Connector service,
**I want** to process Column Banking Platform webhook events,
**so that** payment status updates from Column (ACH, Wire, SWIFT, Real-time) are captured.

**Acceptance Criteria:**
- Implements `WebhookProcessor` interface for Column's webhook format
- Validates Column webhook signatures (provider-specific scheme)
- Processes payment status events: initiated, pending, completed, returned, failed
- Maps Column statuses to internal transaction states
- Supports Column payment rails: ACH, Wire, SWIFT, Real-time Payments

---

### Story 9.3 — Custom Watchlist Management

**As a** compliance team,
**I want** to manage custom watchlists (accept lists, internal block lists) through Bridger's ListMaintenance API,
**so that** we can supplement standard sanctions lists with organization-specific screening rules.

**Acceptance Criteria:**
- CRUD operations for custom lists via Bridger `ListMaintenance` API:
  - `AddList` / `UpdateList` / `DeleteList`
  - `AddRecord` / `UpdateRecord` / `DeleteRecord`
- Accept list: entities that should always pass screening (trusted counterparties)
- Block list: entities that should always fail screening (internal policy)
- Audit log for all watchlist modifications
- Bulk import from CSV for initial list population

---

## Full Story Map — Summary View

```
 ════════════════════════════════════════════════════════════════════════════════
  PHASE 1: Foundation     PHASE 2: Pipeline      PHASE 3: Async     PHASE 4: Hardening
 ════════════════════════════════════════════════════════════════════════════════

 ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ Epic 1   │ │ Epic 2   │ │ Epic 3   │ │ Epic 4   │ │ Epic 5   │ │ Epic 6   │ │ Epic 7   │ │ Epic 8   │ │ Epic 9   │
 │ API      │ │ Payment  │ │Screening │ │ Trax     │ │ Webhook  │ │Compliance│ │Resilience│ │Observ-   │ │Multi-    │
 │ Client   │ │ Parsing  │ │ Pipeline │ │ Integr.  │ │ Receiver │ │Dashboard │ │& Errors  │ │ability   │ │Provider  │
 ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
 │1.1 Token │ │2.1 Parser│ │3.1 Orch. │ │4.1 Hook  │ │5.1 Recv. │ │6.1 Queue │ │7.1 CB    │ │8.1 Logs  │ │9.1 Abstr.│
 │  Service │ │          │ │          │ │          │ │          │ │          │ │          │ │          │ │          │
 │1.2 Search│ │2.2 Mapper│ │3.2 Thresh│ │4.2 Sync  │ │5.2 Brdgr │ │6.2 Decide│ │7.2 Retry │ │8.2 Metr. │ │9.2 Column│
 │  Client  │ │          │ │  Engine  │ │          │ │  Process.│ │          │ │  Policy  │ │          │ │  Integ.  │
 │1.3 Result│ │2.3 Gen.  │ │3.3 State │ │4.3 Batch │ │5.3 Replay│ │6.3 Audit │ │7.3 DLQ   │ │8.3 Alert │ │9.3 Watch-│
 │  Client  │ │  pain002 │ │  Manager │ │          │ │  Protect.│ │  Trail   │ │          │ │  Rules   │ │  lists   │
 └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

  MUST-HAVE ▲                                                                                              ▼ NICE-TO-HAVE
```

---

## Dependencies

```
  Epic 1 ──────────────────────┐
  (API Client)                 │
                               ▼
  Epic 2 ──────────────▶  Epic 3 ──────────▶ Epic 4
  (Parsing)              (Pipeline)          (Trax Integration)
                               │
                               ▼
                          Epic 5 ──────────▶ Epic 6
                          (Webhooks)         (Dashboard)
                               │
                               ▼
                          Epic 7
                          (Resilience)
                               │
                               ▼
                          Epic 8
                          (Observability)
                               │
                               ▼
                          Epic 9
                          (Multi-Provider)
```

---

## Appendix: Story Priority Matrix

| Story | Priority | Effort | Dependencies | Phase |
|-------|----------|--------|-------------|-------|
| 1.1 Token Service | Must | S | None | 1 |
| 1.2 Search Client | Must | M | 1.1 | 1 |
| 1.3 Results Client | Should | M | 1.1 | 1 |
| 2.1 pain.001 Parser | Must | M | None | 1 |
| 2.2 Entity Mapper | Must | S | 2.1 | 1 |
| 2.3 pain.002 Generator | Must | M | None | 1 |
| 3.1 Pipeline Orchestrator | Must | L | 1.2, 2.1, 2.2, 2.3 | 2 |
| 3.2 Threshold Engine | Must | S | None | 2 |
| 3.3 Transaction State Manager | Should | M | None | 2 |
| 4.1 Payment Lifecycle Hook | Must | M | 3.1 | 2 |
| 4.2 Status Synchronization | Must | S | 3.1 | 2 |
| 4.3 Batch Processing | Should | L | 3.1, 4.1 | 2 |
| 5.1 Generic Webhook Receiver | Must | M | None | 3 |
| 5.2 Bridger Event Processor | Must | M | 5.1, 3.3 | 3 |
| 5.3 Replay Protection | Should | S | 5.1 | 3 |
| 6.1 Alert Queue View | Must | M | 3.3 | 3 |
| 6.2 Decision Actions | Must | M | 6.1, 1.3 | 3 |
| 6.3 Audit Trail Viewer | Nice | M | 3.3 | 3 |
| 7.1 Circuit Breaker | Must | M | 1.2 | 4 |
| 7.2 Retry Policy | Must | S | 1.2 | 4 |
| 7.3 Dead Letter Queue | Should | M | 3.1 | 4 |
| 8.1 Structured Logging | Must | M | 3.1 | 4 |
| 8.2 Metrics & Dashboards | Should | M | 8.1 | 4 |
| 8.3 Alerting Rules | Should | S | 8.2 | 4 |
| 9.1 Provider Abstraction | Should | L | 3.1, 5.1 | 4 |
| 9.2 Column Integration | Should | M | 9.1 | 4 |
| 9.3 Custom Watchlists | Nice | M | 1.3 | 4 |

**Effort Key:** S = Small (1–2 days), M = Medium (3–5 days), L = Large (1–2 weeks)
