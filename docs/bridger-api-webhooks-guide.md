# Bridger XG5 REST API & Webhooks — Comprehensive Guide

> **Source material:** `references/BridgerXGWebservicesREST.txt` (BIS298-EN_US, 28 Dec 2023),
> `references/BridgerXGWebhooks.txt` (BIS436-EN_US, 17 Jul 2023), and the POC demo in `poc/`.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Authentication — Token Interface](#2-authentication--token-interface)
3. [Lists Interface](#3-lists-interface)
   - [Lists/DataFiles](#31-listsdatafiles)
   - [Lists/Search — the primary screening call](#32-listssearch--the-primary-screening-call)
4. [Results Interface](#4-results-interface)
   - [Results/Record (DELETE — delete an alert)](#41-resultsrecord-delete--delete-an-alert)
   - [Results/Records (POST — fetch specific alerts by ID)](#42-resultsrecords-post--fetch-specific-alerts-by-id)
   - [Results/SearchRecords (POST — query alerts by criteria)](#43-resultssearchrecords-post--query-alerts-by-criteria)
   - [Results/SetRecordState (POST — update alert state/status)](#44-resultssetrecordstate-post--update-alert-statestatus)
   - [Results/RunInfo (GET — inspect a batch run)](#45-resultsruninfo-get--inspect-a-batch-run)
   - [Results/SearchRuns (POST — find batch runs)](#46-resultssearchruns-post--find-batch-runs)
   - [Results/Run (DELETE — delete a batch run)](#47-resultsrun-delete--delete-a-batch-run)
5. [ListMaintenance Interface](#5-listmaintenance-interface)
6. [Are the REST Calls Synchronous or Asynchronous?](#6-are-the-rest-calls-synchronous-or-asynchronous)
7. [Webhooks](#7-webhooks)
   - [When webhooks fire](#71-when-webhooks-fire)
   - [AlertStateClosed event](#72-alertstateclosed-event)
   - [AlertDecisionApplied event](#73-alertdecisionapplied-event)
   - [Payload validation / HMAC-SHA256 signing](#74-payload-validation--hmac-sha256-signing)
   - [Delivery & retry behaviour](#75-delivery--retry-behaviour)
   - [Setup — is it always available?](#76-setup--is-it-always-available)
8. [End-to-End Screening Flow](#8-end-to-end-screening-flow)
9. [Summary Decision Table](#9-summary-decision-table)

---

## 1. Product Overview

**LexisNexis® Bridger Insight® XG 5** (referred to as XG throughout) is a risk-management platform
that screens entities — people, businesses, payments — against sanctions lists (OFAC SDN, EU
Consolidated Sanctions, UN Consolidated List), PEP databases, and custom lists maintained by your
organisation.

The REST API exposes four interfaces:

| Interface | Purpose |
|---|---|
| **Token** | Obtain a JWT to authenticate subsequent calls |
| **Lists** | Screen entities; discover available lists |
| **Results** | Manage the alerts (screening results) stored in XG |
| **ListMaintenance** | Manage accept lists and custom screening lists |

All communication is HTTPS, all bodies are JSON. The base URL is
`https://<Your XG Environment>/LN.WebServices`.

---

## 2. Authentication — Token Interface

### Endpoint

```
POST /api/Token/Issue
```

### How it works

Every REST call (except `Token/Issue` itself) requires a **bearer JWT** in the `Authorization`
header. You also always need an `X-API-Key` header containing the static API key issued to your
XG client instance.

`Token/Issue` uses **HTTP Basic auth** — the username is `<clientId>/<userId>` and the password is
the XG user password, Base64-encoded together:

```
Authorization: Basic Base64("XGClient/Admin1:$amp1ePa$$w0rd!")
```

The call has no request body.

### Response — `OAuth2Token`

| Field | Type | Meaning |
|---|---|---|
| `access_token` | String | The JWT to include as `Bearer …` on all subsequent calls |
| `token_type` | String | Always `bearer` |
| `expires_in` | Integer | Lifetime in **seconds** (configured per environment; typically 3 600) |
| `expires_on` | Integer | Unix timestamp of expiry |
| `not_before` | Integer | Unix timestamp — token invalid before this time |
| `resource` | String | Resource that issued the token |

### Key considerations

- The JWT **expires**. You must refresh before expiry to avoid 401 errors on subsequent calls.
- There are two JWT issuance modes: **Bridger JWT** (via `Token/Issue`, the common path) and
  **Azure AD JWT** (XG Enterprise only; you use Azure AD's own token endpoint, then pass a
  base64-encoded `X-ClientInfo: <clientId>/<userId>` header to XG on every call instead).
- A dedicated *web-services-only* user account can be created in XG so the password never
  expires.

---

## 3. Lists Interface

Every call to the Lists interface requires three headers:

```
Authorization: Bearer <JWT>
Content-Type:  application/json
X-API-Key:     <clientInstanceApiKey>
```

### 3.1 Lists/DataFiles

```
POST /api/Lists/DataFiles
```

**Purpose:** Returns metadata about every screening list, accept list, and custom screening list
available to your XG client instance. Use this to discover list IDs/names before constructing
searches.

**Request body:** `{ "ClientContext": { … } }`

**Response:** An array of `DataFileInfo` objects:

| Field | Type | Meaning |
|---|---|---|
| `ID` | GUID | Unique list identifier |
| `Name` | String | Human-readable list name (e.g., `OFAC SDN`, `EU Consolidated`) |
| `Description` | String | Longer description |
| `Type` | DataFileType | `UDF` / `ADF` (accept list) / `BDF` (entity list) / `CDF` (country) / `SDF` |
| `Custom` | Boolean | `true` = your organisation's custom screening list |
| `FileDate` | DateTime | When LexisNexis delivered the file |
| `PublishedDate` | DateTime | When the source agency published the file |
| `HasWeakAKAs` | Boolean | `true` = file contains low-quality "also known as" data |
| `SearchCriteria` | String | Delimited list of searchable criteria for this list |

**When to call:** Once at startup (or periodically) to cache the list catalogue. You do not call
this per-payment.

---

### 3.2 Lists/Search — the primary screening call

```
POST /api/Lists/Search
```

**This is the central screening endpoint.** You submit an entity (or a batch of entities, or a
payment message) and receive screening matches back **in the same HTTP response** — see
[Section 6](#6-are-the-rest-calls-synchronous-or-asynchronous) for the synchronous nature of this
call.

#### Request body structure

```json
{
  "EntitySearchRequest": {
    "ClientContext": { … },
    "Configuration": { … },
    "Input": { … }
  }
}
```

#### `ClientContext` class

| Field | Required | Meaning |
|---|---|---|
| `ClientID` | If Azure JWT | Your XG client instance ID |
| `UserID` | If Azure JWT | The user ID submitting the request |
| `ClientReference` | No | Free-text tag echoed back in the response — useful for correlating to your payment reference |
| `DPPA` | For FraudPoint/InstantID | Driver's Privacy Protection Act permissible use (`NA`, `Choice0`–`Choice6`) |
| `GLB` | For FraudPoint/InstantID | Gramm-Leach-Bliley permissible use (`0`, `1`, `2`, `3`, `5`, `6`, `7`, `12`) |

#### `SearchConfiguration` class — the important flags

| Field | Type | Default | Meaning |
|---|---|---|---|
| `PredefinedSearchName` | String | **Required** | Names a search profile configured in the XG UI; controls which lists to search, sensitivity thresholds, field weighting, etc. Every API search must reference one. |
| `WriteResultsToDatabase` | Boolean | `false` | When `true`, XG persists the results as **alerts** in the XG database, generating a `ResultID` and `RunID`. Alerts become visible in the XG UI and are reachable via the Results interface. When `false`, results are returned in-band only and not stored. |
| `AssignResultTo` | AssignmentInfo | unassigned | Assigns generated alerts to a specific role or user(s) for case management. |
| `DuplicateMatchSuppression` | Boolean | `false` | Suppresses re-creating an alert when an open alert already contains an identical match for the same entity. Useful in rerun scenarios. Does **not** apply to EFT (payment) records. |
| `DuplicateMatchSuppressionSameDivisionOnly` | Boolean | `false` | Limits duplicate suppression to alerts within the same division. |
| `ExcludeScreeningListMatches` | Boolean | `false` | Omits match detail from the response to reduce payload size. Response only contains `ResultID`, `RunID`, `HasScreeningListMatches`, and `RecordStatus`. Use when you only need to know *whether* a match occurred, not the full detail. |

#### `AssignmentInfo` class (used in `AssignResultTo`)

| Field | Meaning |
|---|---|
| `Division` | **Required.** Restricts alert access to this division; only users in this division can process alerts. |
| `RolesOrUsers` | One role name **or** one/more user IDs (not both). Round-robin assignment if multiple users. |
| `Type` | `Role` or `User` |
| `EmailNotification` | `true` sends a single email to assigned users when alerts are generated (throttled to once per 60 minutes per user). |

#### `SearchInput` / `InputRecord` — what you can screen

Each `InputRecord` carries exactly one of the following, in priority order (highest first):

| Input type | Class | Use case |
|---|---|---|
| **Structured entity** | `InputEntity` | A named individual or business with parsed fields (name, address, DOB, IDs, etc.) |
| **Text** | `InputText` | Unstructured free text with an optional ID |
| **EFT payment** | `InputEFT` | A raw payment message (ACH, Fedwire, ISO 20022, SWIFT) — XG parses it |
| **Basic ID** | `InputBasicID` | A proprietary list ID for a direct lookup |

For payment screening (most common in a bank context), you use `InputEFT` with
`Type: "ISO20022"` (or `ACH`, `Fedwire`, `SWIFT`). XG parses the payment message and screens
all the parties it finds.

Up to **100 records** per request for entity/text input, or a total payload of **1 MB** for payment
records.

The `RecordID` field on each `InputRecord` is a user-defined number echoed back in the response —
use it to correlate results to your input records.

#### `InputEntity` class

| Field | Required | Meaning |
|---|---|---|
| `EntityType` | **Yes** | `Business`, `Individual`, or `Unknown` |
| `Name` | **Yes** | `InputName` — contains `Full`, `First`, `Middle`, `Last`, `Suffix`, etc. |
| `Addresses` | Varies | `List<InputAddress>` — required for InstantID business searches |
| `IDs` | No | `List<InputID>` — passport, SSN, DUNS, etc. |
| `Gender` | No | `None`, `Female`, `Male`, `Unknown` |
| `AdditionalInfo` | No | Key-value pairs for supplemental data |
| `Phones` | No | `List<InputPhone>` |
| `Account` | No | `InputAccount` — account-level metadata |

#### Response — `SearchResults` class

| Field | Meaning |
|---|---|
| `Records` | `List<ResultRecord>` — one per input record |
| `BlockID` | Echoed from input |
| `ClientReference` | Echoed from `ClientContext.ClientReference` |
| `SearchEngineVersion` | XG engine version string |

Each `ResultRecord` contains:

| Field | Meaning |
|---|---|
| `ResultID` | System-generated alert ID (only populated when `WriteResultsToDatabase: true`) |
| `RunID` | Batch run ID (only populated when `WriteResultsToDatabase: true`) |
| `Record` | The `RecordID` you supplied |
| `Watchlist` | `WatchlistResults` — the list screening outcome |
| `RecordDetails` | `ResultRecordDetails` — full parsed input data |
| `RecordState` | `RecordState` — case management state (state, status, assignment, notes, history) |
| `FraudPoint` | `FraudPointResults` — optional FraudPoint Score |
| `InstantIDBusiness` / `InstantIDIndividual` | Optional InstantID results |
| `EFTID` | User-supplied EFT reference |
| `AttachmentIDs` | File attachments associated with the alert |
| `HasScreeningListMatches` | Boolean — only present when `ExcludeScreeningListMatches: true` |
| `RecordStatus` | Alert status string — only present when `ExcludeScreeningListMatches: true` |

#### `WatchlistResults` class — the key screening outcome

| Field | Meaning |
|---|---|
| `Status` | `NotSearched` / `NoResults` / `Results` |
| `Matches` | `List<WLMatch>` — each potential hit |

`Status: "NoResults"` = clean. `Status: "Results"` = one or more potential matches require review.

Each `WLMatch` carries a confidence score (0–100), the matched list entity details (`WLEntityDetails`),
and contributing field-level scores (`WLAddressMatch`, `WLDOBMatch`, `WLIDMatch`, etc.).

---

## 4. Results Interface

The Results interface manages **stored alerts**. It is only meaningful when you called
`Lists/Search` with `WriteResultsToDatabase: true` — otherwise there are no alerts in XG to
retrieve.

All Results calls require the same `Authorization`, `Content-Type`, and `X-API-Key` headers as the
Lists interface.

---

### 4.1 Results/Record (DELETE — delete an alert)

```
DELETE /api/Results/Record/{id}
```

Permanently deletes a stored alert by its `ResultID`. Returns `true` on success or an `Error`
class on failure. No request body.

---

### 4.2 Results/Records (POST — fetch specific alerts by ID)

```
POST /api/Results/Records
```

**Purpose:** Retrieve the full detail of one or more known alerts in a single call.

**When to use:** You already have the `ResultID`(s) — for example, you stored them when you
called `Lists/Search` with `WriteResultsToDatabase: true`, or a webhook payload delivered them
to you (see Section 7). This is the efficient "give me exactly these alerts" call.

**Request body:**

```json
{
  "ResultRecordsRequest": {
    "ClientContext": { … },
    "Ids": [1234567, 1234568]
  }
}
```

**Response:** `List<ResultRecord>` — same structure as the `Lists/Search` response records.

---

### 4.3 Results/SearchRecords (POST — query alerts by criteria)

```
POST /api/Results/SearchRecords
```

**Purpose:** Find alerts that match a set of filter criteria. Use this when you do not know the
specific `ResultID`s — for example, to list all open alerts for a division, or all alerts from a
date range.

**Request body:**

```json
{
  "SearchResultRecordsRequest": {
    "ClientContext": { … },
    "ResultsCriteria": { … },
    "Position": 0,
    "NumberToReturn": 50
  }
}
```

`Position` and `NumberToReturn` implement pagination.

**`ResultsCriteria` — key filter fields:**

| Field | Meaning |
|---|---|
| `RecordState.AlertState` | `Open`, `Closed`, or `Unassigned` |
| `RecordState.CurrentStatus` | Filter by a specific alert status string |
| `RecordState.AssignedTo` | Filter by assigned user or role |
| `RecordState.Divisions` | Restrict to specific divisions |
| `RecordState.AlertAge` | `Days10`, `Days20`, `Days30`, `Days60`, `Days90` |
| `DateStart` / `DateEnd` | Alert creation date range |
| `RunIDs` | Limit to alerts from specific batch runs |
| `FullName` / `FirstName` / `LastName` | Filter by entity name |
| `EFT.TransactionID` | Filter by your payment transaction ID |
| `EFT.Type` | `ACH`, `Fedwire`, `ISO20022`, `SWIFT` |
| `Watchlist` | `WatchlistResultCriteria` — e.g., filter by list name or match status |
| `EntityType` | `Business`, `Individual`, `Unknown`, `Text`, `Unstructured` |

**Response:** `SearchRecordResults` — a paged list of `ResultRecord` objects.

---

### 4.4 Results/SetRecordState (POST — update alert state/status)

```
POST /api/Results/SetRecordState
```

**Purpose:** Apply a case-management decision to a stored alert. This is how your compliance
workflow writes back to XG — e.g., marking an alert as "Transaction Approved" and closing it,
or assigning it to a compliance officer role.

**Request body:**

```json
{
  "SetRecordStateRequest": {
    "ClientContext": { … },
    "ResultID": 1234567,
    "RecordState": {
      "AlertState": "Closed",
      "Status": "Transaction Approved",
      "Note": "Auto-approved: score below threshold",
      "AssignedTo": ["ComplianceRole"],
      "AssignmentType": "Role",
      "Division": "Payments",
      "MatchStates": [
        { "MatchID": 99, "Type": "FalsePositive" }
      ]
    }
  }
}
```

**`RecordState` fields:**

| Field | Meaning |
|---|---|
| `AlertState` | `Open`, `Closed` (setting `Closed` finalises the alert) |
| `Status` | A status string configured in the XG application (e.g., `Transaction Approved`, `Blocked Account`, `Under Investigation`) |
| `Note` | Free-text note added to the audit trail |
| `AssignedTo` | Role name **or** user ID list |
| `AssignmentType` | `Role` or `User` — cannot assign when `AlertState: Closed` |
| `Division` | Restricts access to this division |
| `MatchStates` | Per-match decisions: `FalsePositive` or `TrueMatch` |

**Response:** Boolean (`true` / `false`).

**This is the key write-back operation.** Once called, if configured, it **triggers a webhook** (see
Section 7).

---

### 4.5 Results/RunInfo (GET — inspect a batch run)

```
GET /api/Results/RunInfo/{id}
```

Returns metadata about a specific batch run (a group of alerts generated in one submission):
alert count, error count, processing state, predefined search name, submit type, start time, etc.

---

### 4.6 Results/SearchRuns (POST — find batch runs)

```
POST /api/Results/SearchRuns
```

Queries for batch runs by criteria: date range, EFT type, entity type, processing state
(`Completed`, `Processing`, `Error`, `Canceled`, …), submit type (`WebServices`, `Batch`,
`RealTime`, etc.).

---

### 4.7 Results/Run (DELETE — delete a batch run)

```
DELETE /api/Results/Run/{id}
```

Permanently deletes a run and all its associated alerts.

---

## 5. ListMaintenance Interface

Used to manage **accept lists** (suppress known-good false positives in future searches) and
**custom screening lists** (flag entities specific to your organisation). Less commonly called
per-payment; more relevant for list administration:

| Method | Endpoint | Purpose |
|---|---|---|
| `AddList` | `POST /api/ListMaintenance/AddList` | Create a new accept list or custom list |
| `UpdateList` | `POST /api/ListMaintenance/UpdateList` | Rename or modify a list |
| `DeleteList` | `POST /api/ListMaintenance/DeleteList` | Delete a list |
| `List` | `POST /api/ListMaintenance/List` | Retrieve list metadata |
| `SearchLists` | `POST /api/ListMaintenance/SearchLists` | Find lists by criteria |
| `IndexList` | `POST /api/ListMaintenance/IndexList` | Re-index a custom list after bulk updates |
| `AddRecord` | `POST /api/ListMaintenance/Record` | Add an entity to a list |
| `GetRecord` | `GET /api/ListMaintenance/Record` | Retrieve a list record |
| `ResultRecord` | `POST /api/ListMaintenance/ResultRecord` | Add an alert's entity directly to a list |

In a payment screening context, your compliance workflow might call `AddRecord` (or use the
`AddedToAcceptList` mechanism via `SetRecordState`) when a compliance officer confirms a match
is a false positive, so future payments for that counterparty are not re-flagged.

---

## 6. Are the REST Calls Synchronous or Asynchronous?

**All REST calls are synchronous — they block and return immediately with a complete response.**

There is no polling, no job ID, no callback URL involved in the REST API itself.

| Scenario | Behaviour |
|---|---|
| `Lists/Search` with `WriteResultsToDatabase: false` | Screens the entity in-process, returns full match results in the HTTP response body. The entire round-trip is synchronous. |
| `Lists/Search` with `WriteResultsToDatabase: true` | Same as above: results are returned in the same HTTP response **and** persisted to the database simultaneously. You get match results in-band immediately. The `ResultID` and `RunID` in the response can then be used to retrieve/update the stored alert. |
| All Results interface calls | Each call is a single synchronous HTTP request/response. |

**The consequence:** There is no need to poll Bridger to find out the outcome of a search. You
call `Lists/Search`, you get the answer. This is what the demo (`03-screening-flow.html`) shows:
each payment entity is screened in a single request and the result is available before the next
step executes.

**Webhooks are not a replacement for this synchronous result.** They serve a different purpose —
they notify you of *subsequent changes* to an alert's state made by a human or automated process
inside XG (see Section 7).

---

## 7. Webhooks

### 7.1 When webhooks fire

Webhooks are outbound push notifications that XG sends to **your** receiving application when
certain events occur **after** the initial screening call. They do not fire when `Lists/Search`
runs — they fire when case-management actions are taken on a stored alert.

Two event types are supported:

| Event | Fires when |
|---|---|
| **AlertStateClosed** | An alert's state is set to `Closed` (i.e., a final decision has been recorded) |
| **AlertDecisionApplied** | Any of: alert state/status/assignment changes; alert added to accept list or custom screening list; decision tag or note added; **or** a file attachment added/deleted |

XG can send notifications triggered by:
- Actions taken in the **XG UI** by a compliance officer
- The **REST API** call to `SetRecordState`
- The **SOAP API** calls `SetRecordState`, `AddResultRecord`, `AddAttachment`, `DeleteAttachment`
  (note: `AddAttachment` / `DeleteAttachment` are not available in REST API, only SOAP)

**Important limitations from the official docs:**
- Only one active webhook per event type is recommended. If you have active webhooks for both
  event types and an event satisfies both criteria (e.g., closing an alert also applies a
  decision), **two notifications are sent**.
- Notifications are **not sent** for bulk/multiple-entity operations.

---

### 7.2 AlertStateClosed event

Fires when an alert is individually closed with a final status.

**Payload example:**

```json
{
  "ResultId": 1234567,
  "EventType": "AlertClosed",
  "Status": "Blocked Account",
  "DateCreated": "2023-04-22T12:10:40Z",
  "DateModified": "2023-04-24T12:10:59.622Z",
  "State": "Closed",
  "Note": 1,
  "AssignedTo": "Administrator",
  "AssignmentType": "Role",
  "DecisionTags": ["NeedsReview"],
  "AddedToCSL": 1,
  "AddedToAcceptList": 1
}
```

**Payload fields:**

| Field | Type | Meaning |
|---|---|---|
| `ResultId` | Long | The XG alert ID — use this to call `Results/Records` for full detail |
| `EventType` | String | Always `AlertClosed` for this event |
| `Status` | String | The alert status set at closure (e.g., `Transaction Approved`, `Blocked Account`, `Undetermined`). `None` means the status field was cleared. |
| `DateCreated` | DateTime | When the alert was originally created |
| `DateModified` | DateTime | When the closure action was taken |
| `EFTId` | Long | EFT ID of the payment that triggered the alert |
| `State` | String | `Closed`, `Open`, or `Unassigned` |
| `Note` | Boolean (1/0) | `1` = a note was added to the alert |
| `AssignedTo` | String | User or role the alert was assigned to |
| `AssignmentType` | String | `Role`, `User`, or `Unknown` (unknown = assignment cleared) |
| `DecisionTags` | List\<String\> | Decision tags applied (e.g., `NeedsReview`, `FalsePositive`) |
| `AddedToAcceptList` | Boolean (1/0) | `1` = entity added to accept list |
| `AddedToCSL` | Boolean (1/0) | `1` = entity added to custom screening list |

Note: fields are only present if the related field actually changed during the event.

---

### 7.3 AlertDecisionApplied event

Fires for any incremental case-management action — including partial decisions, reassignments,
file attachments, and note additions — not just final closure.

**Payload example (decision applied):**

```json
{
  "ResultId": 1234567,
  "EventType": "AlertDecisionApplied",
  "Status": "Undetermined",
  "DateCreated": "2023-04-07T19:09:58Z",
  "DateModified": "2023-04-18T19:13:46.998Z",
  "EFTId": "36ff0df7-1356-4c9a-8e8a-fbb3c5cbxxxx",
  "State": "Closed",
  "Note": 1,
  "AssignedTo": "System Administrator",
  "AssignmentType": "User",
  "DecisionTags": ["NeedDocuments"],
  "AddedToCSL": 1,
  "AddedToAcceptList": 1
}
```

**Payload example (file attached):**

```json
{
  "ResultId": 123456789,
  "EventType": "AlertDecisionApplied",
  "State": "Open",
  "Attachments": {
    "Event": "Add",
    "Files": [
      { "Id": 11118, "File": "IDPhoto.png" }
    ]
  },
  "Note": 1
}
```

Additional fields beyond `AlertStateClosed`:

| Field | Type | Meaning |
|---|---|---|
| `AttachmentIDs` | List\<Long\> | System-generated IDs for file attachments |
| `Attachments.Event` | String | `Add` or `Delete` |
| `Attachments.Files` | Array | `Id` + `File` (filename) per attachment |

---

### 7.4 Payload validation / HMAC-SHA256 signing

Every webhook payload arrives with three HTTP headers for tamper verification. You **must**
validate these before trusting the payload:

| Header | Example value | Purpose |
|---|---|---|
| `x-ms-date` | `Thu, 15 Jun 2023 22:30:59 GMT` | UTC timestamp of when XG sent the payload |
| `x-ms-content-sha256` | `cPYE02RM5qLuC1uIPPIhs8iZ0XA6U0QSUMPSsz2PnTQ=` | Base64(SHA256(raw JSON body)) |
| `Authorization` | `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=IDw6…` | HMAC signature |

**Validation procedure (4 steps):**

1. **Verify content hash:** Compute `Base64(SHA256(requestBody))`. Compare with
   `x-ms-content-sha256` — they must match. If they differ, the payload was tampered with.

2. **Construct the signed string:**
   ```
   StringThatIsSigned = "POST\n" + requestUri.PathAndQuery + "\n"
                       + date + ";" + host + ";" + contentHash
   ```
   Where:
   - `requestUri.PathAndQuery` = the path portion of your webhook URL (e.g., `/webhooks/bridger`)
   - `date` = value from `x-ms-date`
   - `host` = host:port of your receiving URL (e.g., `my-app.example.com:443`)
   - `contentHash` = value from `x-ms-content-sha256`

3. **Compute HMAC:** Create an HMAC-SHA256 using the **webhook secret** (the shared secret you
   configured when adding the webhook in XG) as the key.

4. **Verify signature:** Hash the `StringThatIsSigned` with the HMAC. Base64-encode the result.
   Compare with the `Signature=` portion of the `Authorization` header. If they match, the
   payload is authentic and came from XG.

**The payloads do not contain PII.** They carry only the `ResultId` and metadata. To get the
full screening detail, call `Results/Records` with the `ResultId`.

---

### 7.5 Delivery & retry behaviour

| Behaviour | Detail |
|---|---|
| Protocol | HTTPS POST to your configured payload URL |
| Expected availability | Your endpoint should be available **at least 12 hours/day** |
| On failure | XG retries every **30 minutes for 24 hours** |
| After 24 hours | Webhook is **automatically disabled** and the payload is permanently deleted |
| If webhook is disabled during retry | Future retries for that event are prevented. But if disabled then re-enabled *before* the retry fires, delivery continues. |

**Practical implication:** Your receiving endpoint must be reliable and idempotent. You can
receive the same payload more than once (on retry after a transient failure). Use `ResultId` as
an idempotency key.

---

### 7.6 Setup — is it always available?

**No — webhooks require explicit configuration and are not available by default.**

| Deployment type | What you must do |
|---|---|
| **XG Enterprise** | Enable webhooks in Enterprise Manager for each client instance (`Product Settings → Webhooks`). Then configure webhooks inside the XG UI. |
| **XG Service** (cloud-hosted by LexisNexis) | Submit a request to LexisNexis Risk Solutions to enable webhook functionality for your client instance. You cannot self-enable it. |

Once enabled at the instance level:

1. **Set up roles** — users who manage webhooks need the `Webhooks` privilege (`Read Only`,
   `Add/Edit`, or `Add/Edit/Delete`) on their role.
2. **Add a webhook** via `Administration → Webhooks → Add Webhook`:
   - **Name** (unique)
   - **Event** (`Alert State Closed` or `Alert Decision Applied`)
   - **Payload URL** — your receiving application's HTTPS endpoint
   - **Secret** — a shared secret your application uses for HMAC validation
   - **Active** checkbox — webhook only fires when active
3. The secret is not retrievable after saving; you can only replace it via `Change Secret`.

**Summary:** Webhooks are an optional, add-on capability. They require both product-level
enablement (either self-served in Enterprise Manager or requested from LexisNexis for XG
Service) and per-instance configuration. A basic integration that calls `Lists/Search` and
reads the synchronous response does **not** require webhooks.

---

## 8. End-to-End Screening Flow

Below is a complete flow for a payment screening scenario (as demonstrated in `poc/03-screening-flow.html`).

### Step 1 — Authenticate

```
POST /api/Token/Issue
Authorization: Basic Base64("client/user:password")
```

Cache the returned JWT. Refresh before `expires_in` seconds elapse.

### Step 2 — (Optional, once) Discover available lists

```
POST /api/Lists/DataFiles
Authorization: Bearer <JWT>
X-API-Key: <apiKey>
{ "ClientContext": { "ClientID": "…", "UserID": "…" } }
```

Cache the list catalogue so you can name lists in `PredefinedSearch` configurations.

### Step 3 — Screen the payment

```
POST /api/Lists/Search
Authorization: Bearer <JWT>
X-API-Key: <apiKey>

{
  "EntitySearchRequest": {
    "ClientContext": {
      "ClientID": "MyBank",
      "UserID": "screening-service",
      "ClientReference": "PMT-20260218-00042"
    },
    "Configuration": {
      "PredefinedSearchName": "PaymentScreening",
      "WriteResultsToDatabase": true,
      "AssignResultTo": {
        "Division": "ComplianceDept",
        "RolesOrUsers": ["ComplianceTeam"],
        "Type": "Role",
        "EmailNotification": false
      }
    },
    "Input": {
      "Records": [
        {
          "RecordID": 1,
          "EFT": {
            "EFTID": "PMT-20260218-00042",
            "Type": "ISO20022",
            "Value": "<base64-encoded-pain001-xml>"
          }
        }
      ]
    }
  }
}
```

**Response arrives synchronously.** Inspect each `ResultRecord.Watchlist.Status`:

| `Status` | Meaning | Action |
|---|---|---|
| `NoResults` | No watchlist matches | Release payment (or auto-approve in Trax) |
| `Results` | Potential matches found | Hold payment; route to compliance for review |
| `NotSearched` | List was not searched | Investigate configuration |

If `WriteResultsToDatabase: true`, record the `ResultID` and `RunID` for each record — you need
them for future state updates.

### Step 4 — (Optional) Update alert state from your system

If your system (e.g., Trax) auto-approves or auto-rejects based on score thresholds, call:

```
POST /api/Results/SetRecordState
Authorization: Bearer <JWT>
X-API-Key: <apiKey>

{
  "SetRecordStateRequest": {
    "ClientContext": { … },
    "ResultID": 1234567,
    "RecordState": {
      "AlertState": "Closed",
      "Status": "Transaction Approved",
      "Note": "Auto-approved: score 18, below threshold 30"
    }
  }
}
```

### Step 5 — Compliance officer reviews in XG UI (if held)

For alerts held for human review, the compliance officer works in the XG application or via your
in-house compliance dashboard. They may:
- Change status to `Under Investigation`
- Add notes or file attachments
- Apply per-match decisions (`FalsePositive` / `TrueMatch`)
- Close the alert with a final status (`Transaction Approved` / `Blocked Account` / etc.)

### Step 6 — Webhook notifies your system of the decision (if configured)

When the officer closes the alert (or each time they apply a decision), XG fires a webhook POST
to your configured URL:

```
POST https://your-app.example.com/webhooks/bridger
x-ms-date: Thu, 18 Feb 2026 10:22:00 GMT
x-ms-content-sha256: <hash>
Authorization: HMAC-SHA256 SignedHeaders=…&Signature=…

{
  "ResultId": 1234567,
  "EventType": "AlertClosed",
  "Status": "Transaction Approved",
  "State": "Closed",
  "DateModified": "2026-02-18T10:22:00Z"
}
```

Your application:
1. Validates HMAC signature
2. Calls `Results/Records` with `ResultId: 1234567` if it needs full alert detail
3. Maps `Status` to a Trax payment state (e.g., `Transaction Approved` → `EXTERNAL_ACCEPTED` →
   release payment; `Blocked Account` → `EXTERNAL_REJECTED` → reject payment)
4. Returns HTTP 200 to acknowledge receipt

---

## 9. Summary Decision Table

| Question | Answer |
|---|---|
| Which endpoint does the actual screening? | `POST /api/Lists/Search` |
| Is screening synchronous? | Yes — result is in the HTTP response body, no polling |
| When should I use `WriteResultsToDatabase: true`? | Whenever you need case management, webhooks, or auditability. Use `false` for stateless/ephemeral screening. |
| What does `Lists/DataFiles` do? | Returns the catalogue of available screening lists — call once at startup, not per-payment |
| What does `Results/Records` do? | Fetches full alert detail by known `ResultID` list — use after a webhook delivers a `ResultId` |
| What does `Results/SearchRecords` do? | Queries alerts by filter criteria — use for compliance dashboard queries, not real-time payment flow |
| What does `Results/SetRecordState` do? | Writes a case-management decision back to XG — triggers webhooks |
| Are webhooks required? | No — they are optional and require explicit enablement |
| What triggers a webhook? | A `SetRecordState` API call, or a human action in the XG UI, on an individual alert |
| Do webhooks fire on `Lists/Search`? | No — only on subsequent state-change actions |
| How do I validate a webhook payload? | HMAC-SHA256 with your configured secret; verify `x-ms-content-sha256` and reconstruct the signed string |
| What if my webhook endpoint is down? | XG retries every 30 minutes for 24 hours, then disables the webhook and drops the payload |
| Can I screen ISO 20022 payments? | Yes — `InputEFT.Type: "ISO20022"` with the XML base64-encoded in `Value`; XG parses all parties |
| What is a `PredefinedSearch`? | A named search profile configured in the XG UI; required on every `Lists/Search` call; controls which lists to screen against and sensitivity settings |
| How do I suppress false-positive re-matches? | Use `DuplicateMatchSuppression: true` in `SearchConfiguration`, or add the entity to an accept list via `ListMaintenance/ResultRecord` |
