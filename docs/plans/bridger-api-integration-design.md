# Bridger API Integration Design

## Integration of LexisNexis Bridger Insight XG5 with Bank Connector and Trax External Screening

**Version:** 1.0
**Date:** 2026-01-13
**Status:** Design Proposal

---

## 1. Executive Summary

This document outlines the design for integrating the full LexisNexis Bridger Insight XG5 REST API into the FIS Bank Connector, enabling seamless sanctions and compliance screening capabilities for payment transactions processed through Trax. The integration leverages Trax's existing external screening workflow states (`EXTERNAL_ACCEPTED`, `EXTERNAL_REJECTED`, `EXTERNAL_SUSPECT`) and positions Bank Connector as the unified communication layer for all external compliance services.

### Key Objectives

1. **Real-time Payment Screening**: Screen all outgoing payments against global sanctions lists, PEP databases, and custom watchlists
2. **Automated Alert Management**: Process screening alerts and apply decisions based on configurable rules
3. **Unified Architecture**: Align with the Trax monolith decomposition strategy, positioning this as a microservice-ready component
4. **Compliance Reporting**: Generate audit trails and compliance reports required by regulations

---

## 2. System Landscape

### 2.1 Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT STATE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐        ┌──────────────────┐        ┌─────────────────────┐   │
│  │   ERP    │───────►│      TRAX        │───────►│   Bank Connector    │   │
│  │ Systems  │        │  (Payment Hub)   │        │                     │   │
│  └──────────┘        │                  │        │  ┌───────────────┐  │   │
│                      │  - Workflows     │        │  │ SWIFT/FIN     │  │   │
│                      │  - Validation    │        │  │ SWIFT/FileAct │  │   │
│                      │  - Routing       │        │  │ EBICS         │  │   │
│                      │  - Screening?    │◄───────│  │ Bank APIs     │  │   │
│                      │    (manual/none) │        │  └───────────────┘  │   │
│                      └──────────────────┘        └─────────────────────┘   │
│                                                                              │
│                      ❌ No automated compliance screening                    │
│                      ❌ Manual intervention required                         │
│                      ❌ Compliance risk exposure                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Target State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TARGET STATE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐        ┌──────────────────┐        ┌─────────────────────┐   │
│  │   ERP    │───────►│      TRAX        │───────►│   Bank Connector    │   │
│  │ Systems  │        │  (Payment Hub)   │        │ (Comm. Service)     │   │
│  └──────────┘        │                  │        │                     │   │
│                      │  - Workflows     │        │  ┌───────────────┐  │   │
│                      │  - Validation    │◄───────│  │ SWIFT/FIN     │  │   │
│                      │  - Routing       │        │  │ SWIFT/FileAct │  │   │
│                      │  - Ext Screening │        │  │ EBICS         │  │   │
│                      │    Integration   │        │  │ Bank APIs     │  │   │
│                      └────────┬─────────┘        │  │               │  │   │
│                               │                  │  │ ┌───────────┐ │  │   │
│                               │                  │  │ │ BRIDGER   │ │  │   │
│                               └──────────────────│──│►│ XG5 API   │ │  │   │
│                                                  │  │ │ Connector │ │  │   │
│                                                  │  │ └───────────┘ │  │   │
│                                                  │  └───────────────┘  │   │
│  ┌──────────────────────────────────────────┐   └──────────┬──────────┘   │
│  │           Bridger Insight XG5            │◄─────────────┘              │
│  │  ┌────────────────────────────────────┐  │                              │
│  │  │ - Sanctions Lists (OFAC, EU, UN)   │  │                              │
│  │  │ - PEP Databases                    │  │                              │
│  │  │ - Custom Screening Lists           │  │                              │
│  │  │ - WorldCompliance Data             │  │                              │
│  │  │ - Alert Management                 │  │                              │
│  │  │ - Webhooks                         │  │                              │
│  │  └────────────────────────────────────┘  │                              │
│  └──────────────────────────────────────────┘                              │
│                                                                              │
│  ✓ Automated real-time screening                                            │
│  ✓ Configurable risk thresholds                                             │
│  ✓ Full audit trail                                                         │
│  ✓ Compliance officer workflow                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Bridger XG5 API Overview

### 3.1 Key API Interfaces

| Interface | Purpose | Key Methods |
|-----------|---------|-------------|
| **Token** | Authentication | `Issue` - Obtain JWT |
| **Lists** | Screening Operations | `Search`, `DataFiles` |
| **Results** | Alert Management | `Record`, `Records`, `SearchRecords`, `SetRecordState` |
| **ListMaintenance** | List Management | `AddList`, `AddRecord`, `IndexList` |

### 3.2 Authentication Flow

```
┌────────────────┐                    ┌──────────────────┐
│ Bank Connector │                    │ Bridger XG5 API  │
└───────┬────────┘                    └────────┬─────────┘
        │                                      │
        │  POST /api/Token/Issue               │
        │  Authorization: Basic <credentials>  │
        │─────────────────────────────────────►│
        │                                      │
        │  200 OK                              │
        │  { access_token, expires_in }        │
        │◄─────────────────────────────────────│
        │                                      │
        │  [Cache token, refresh before expiry]│
        │                                      │
```

### 3.3 Search API Structure

**Endpoint:** `POST /api/Lists/Search`

**Required Headers:**
- `Authorization: Bearer <JWT>`
- `X-API-Key: <client_api_key>`
- `Content-Type: application/json`

**Key Request Elements:**

```json
{
  "ClientContext": {
    "ClientID": "string",
    "UserID": "string",
    "ClientReference": "string",
    "DPPA": "Choice0",
    "GLB": 0
  },
  "Configuration": {
    "PredefinedSearchName": "string",
    "WriteResultsToDatabase": true,
    "AssignResultTo": {
      "Division": "string",
      "Type": "Role|User",
      "RolesOrUsers": ["string"]
    }
  },
  "Input": {
    "Records": [
      {
        "RecordID": 12345,
        "Entity": {
          "EntityType": "Individual|Business|Unknown",
          "Name": { "First": "", "Last": "", "Full": "" },
          "Addresses": [...],
          "IDs": [...]
        }
      }
    ]
  }
}
```

---

## 4. Integration Architecture

### 4.1 Component Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BANK CONNECTOR BRIDGER MODULE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        BRIDGER CHANNEL                               │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ Auth Manager │  │  API Client  │  │   Webhook Receiver       │  │   │
│  │  │              │  │              │  │                          │  │   │
│  │  │ - JWT cache  │  │ - REST calls │  │ - Alert notifications    │  │   │
│  │  │ - Refresh    │  │ - Retry      │  │ - Decision callbacks     │  │   │
│  │  │ - Failover   │  │ - Circuit    │  │ - HMAC validation        │  │   │
│  │  │              │  │   breaker    │  │                          │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │   │
│  │         │                 │                       │                 │   │
│  │  ┌──────┴─────────────────┴───────────────────────┴─────────────┐  │   │
│  │  │                    MESSAGE TRANSFORMER                        │  │   │
│  │  │                                                               │  │   │
│  │  │  ┌─────────────────┐     ┌─────────────────┐                 │  │   │
│  │  │  │ Trax → Bridger  │     │ Bridger → Trax  │                 │  │   │
│  │  │  │                 │     │                 │                 │  │   │
│  │  │  │ - Payment data  │     │ - Match results │                 │  │   │
│  │  │  │ - Party extract │     │ - Risk scores   │                 │  │   │
│  │  │  │ - Entity build  │     │ - Alert status  │                 │  │   │
│  │  │  └─────────────────┘     └─────────────────┘                 │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                    SCREENING ORCHESTRATOR                      │  │   │
│  │  │                                                                │  │   │
│  │  │  - Batch aggregation (max 100 records)                        │  │   │
│  │  │  - Priority queuing                                           │  │   │
│  │  │  - Async/sync mode selection                                  │  │   │
│  │  │  - Result caching (configurable TTL)                          │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CONFIGURATION (bridger-config.yml)                │   │
│  │                                                                      │   │
│  │  bridger:                                                           │   │
│  │    api:                                                             │   │
│  │      baseUrl: https://xg.bridger.example.com/LN.WebServices         │   │
│  │      clientId: ${BRIDGER_CLIENT_ID}                                 │   │
│  │      userId: ${BRIDGER_USER_ID}                                     │   │
│  │      apiKey: ${BRIDGER_API_KEY}                                     │   │
│  │      password: ${BRIDGER_PASSWORD}                                  │   │
│  │    search:                                                          │   │
│  │      predefinedSearchName: "PaymentScreening"                       │   │
│  │      writeResultsToDatabase: true                                   │   │
│  │      assignToDivision: "Compliance"                                 │   │
│  │    thresholds:                                                      │   │
│  │      autoAccept: 30                                                 │   │
│  │      autoReject: 90                                                 │   │
│  │      reviewRange: [31, 89]                                          │   │
│  │    webhook:                                                         │   │
│  │      enabled: true                                                  │   │
│  │      endpoint: /api/bridger/webhook                                 │   │
│  │      hmacSecret: ${BRIDGER_WEBHOOK_SECRET}                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow: Payment Screening

```
┌────────┐    ┌───────┐    ┌────────────────┐    ┌──────────────┐    ┌─────────┐
│  ERP   │    │ TRAX  │    │ Bank Connector │    │ Bridger XG5  │    │Webhooks │
└───┬────┘    └───┬───┘    └───────┬────────┘    └──────┬───────┘    └────┬────┘
    │             │                │                    │                 │
    │ Payment     │                │                    │                 │
    │ File        │                │                    │                 │
    │────────────►│                │                    │                 │
    │             │                │                    │                 │
    │             │ Route to       │                    │                 │
    │             │ Ext Screen     │                    │                 │
    │             │───────────────►│                    │                 │
    │             │                │                    │                 │
    │             │                │ Extract parties    │                 │
    │             │                │ (Debtor, Creditor, │                 │
    │             │                │  Intermediaries)   │                 │
    │             │                │                    │                 │
    │             │                │ POST /Lists/Search │                 │
    │             │                │───────────────────►│                 │
    │             │                │                    │                 │
    │             │                │     Results        │                 │
    │             │                │◄───────────────────│                 │
    │             │                │                    │                 │
    │             │                │ Apply thresholds   │                 │
    │             │                │ Determine status   │                 │
    │             │                │                    │                 │
    │             │ EXTERNAL_*     │                    │                 │
    │             │ status update  │                    │                 │
    │             │◄───────────────│                    │                 │
    │             │                │                    │                 │
    │             │                │                    │  Alert Decision │
    │             │                │                    │  Applied        │
    │             │                │◄────────────────────────────────────│
    │             │                │                    │                 │
    │             │ Update final   │                    │                 │
    │             │ status         │                    │                 │
    │             │◄───────────────│                    │                 │
    │             │                │                    │                 │
```

---

## 5. Message Mapping

### 5.1 Trax Payment to Bridger Entity

The integration extracts screening-relevant parties from payment messages:

| Payment Field (ISO 20022) | Bridger Entity Field | Notes |
|---------------------------|----------------------|-------|
| `Dbtr/Nm` | `Name.Full` | Debtor name |
| `Dbtr/PstlAdr/*` | `Addresses[0].*` | Debtor address |
| `Dbtr/Id/OrgId/LEI` | `IDs[].Number` (type: LEI) | Legal Entity ID |
| `Dbtr/Id/PrvtId/DtAndPlcOfBirth` | `Date.DateOfBirth` | Individual DOB |
| `Cdtr/Nm` | `Name.Full` | Creditor name |
| `Cdtr/PstlAdr/*` | `Addresses[0].*` | Creditor address |
| `UltmtDbtr/*` | Additional entity | Ultimate debtor |
| `UltmtCdtr/*` | Additional entity | Ultimate creditor |
| `IntrmyAgt1/*` | Additional entity | Intermediary bank |

### 5.2 Bridger Result to Trax Screening Status

| Bridger Result | Match Score | Trax Status | Action |
|----------------|-------------|-------------|--------|
| No matches | N/A | `EXTERNAL_ACCEPTED` | Auto-release |
| Matches found | < 30 | `EXTERNAL_ACCEPTED` | Auto-release (low confidence) |
| Matches found | 30-89 | `EXTERNAL_SUSPECT` | Hold for review |
| Matches found | ≥ 90 | `EXTERNAL_REJECTED` | Block payment |
| API Error | N/A | `EXTERNAL_SUSPECT` | Hold + alert ops |

### 5.3 Screening Response Structure

```json
{
  "paymentReference": "PAY-2026-001234",
  "screeningTimestamp": "2026-01-13T10:30:00Z",
  "overallStatus": "SUSPECT",
  "parties": [
    {
      "partyType": "DEBTOR",
      "partyName": "John Smith",
      "screeningStatus": "CLEAR",
      "matches": []
    },
    {
      "partyType": "CREDITOR",
      "partyName": "ACME Trading Ltd",
      "screeningStatus": "MATCH",
      "matches": [
        {
          "matchId": 12345678,
          "listName": "OFAC SDN",
          "listEntityName": "ACME Trading Co.",
          "matchScore": 85,
          "matchType": "Name",
          "entityType": "Business",
          "reasonListed": "Sanctions Program: IRAN",
          "dateListed": "2024-06-15"
        }
      ]
    }
  ],
  "bridgerRunId": 98765432,
  "bridgerResultIds": [12345678, 12345679]
}
```

---

## 6. Trax Integration Points

### 6.1 Workflow Integration

The integration hooks into Trax's existing communication and routing framework:

**Outgoing Routing Configuration:**

```yaml
# trax-config.yml addition
outgoingRouting:
  - code: "PAY_BRIDGER_SCREENING"
    description: "Bridger XG5 Compliance Screening"
    workflow: "PAY"
    channel: "INTEGRATION_CHANNEL"
    profile: "BRIDGER_SCREENING"
    filter:
      - field: "paymentStatus"
        value: "TO_BE_RELEASED"
    action: "EXTERNAL_SCREENING"
```

**Integration Channel Profile:**

```yaml
# integration-channel-config.yml
profiles:
  BRIDGER_SCREENING:
    type: "BRIDGER"
    mode: "SYNC"  # or ASYNC for high-volume
    timeout: 30000
    retryPolicy:
      maxRetries: 3
      backoffMultiplier: 2
      initialDelay: 1000
    batchSize: 50  # Aggregate up to 50 payments
    batchTimeout: 5000  # Max wait time for batch
```

### 6.2 Response Subscription

Configure how Trax handles screening responses:

```yaml
# response-subscription.yml
subscriptions:
  - name: "BRIDGER_SCREENING_RESULT"
    sourceChannel: "BRIDGER"
    eventType: "SCREENING_COMPLETE"
    targetProfile: "PAY_SCREENING_RESPONSE"
    mapping:
      - source: "overallStatus"
        target: "externalScreeningStatus"
      - source: "screeningTimestamp"
        target: "screeningDate"
      - source: "bridgerRunId"
        target: "externalReference"
```

### 6.3 Existing Trax Workflow States

The design leverages Trax's pre-existing external screening inventory codes:

| Inventory Code | Description | Next Steps |
|----------------|-------------|------------|
| `UP_PMT_EXTERNAL_SUSPECT` | Unitary payment awaiting review | Manual decision |
| `BP_PMT_EXTERNAL_ACCEPTED` | Batch payment cleared | Continue to release |
| `BP_PMT_EXTERNAL_REJECTED` | Batch payment blocked | Cancel/investigate |
| `BP_PMT_EXTERNAL_SUSPECT` | Batch payment needs review | Manual decision |
| `PAY_PMT_REL_EXTERNAL_ACCEPTED` | Pay factory released | Continue transmission |
| `PAY_PMT_REL_EXTERNAL_REJECTED` | Pay factory blocked | Block transmission |
| `PAY_PMT_REL_EXTERNAL_SUSPECT` | Pay factory held | Compliance review |

---

## 7. Webhook Integration

### 7.1 Supported Events

Bridger XG5 supports two webhook event types:

1. **AlertStateClosed**: Triggered when an alert is closed
2. **AlertDecisionApplied**: Triggered on any decision action

### 7.2 Webhook Handler Design

```java
@RestController
@RequestMapping("/api/bridger/webhook")
public class BridgerWebhookController {

    @PostMapping
    public ResponseEntity<Void> handleWebhook(
            @RequestHeader("x-ms-date") String date,
            @RequestHeader("x-ms-content-sha256") String contentHash,
            @RequestHeader("Authorization") String signature,
            @RequestBody String payload) {

        // 1. Validate HMAC signature
        if (!validateSignature(date, contentHash, signature, payload)) {
            return ResponseEntity.status(401).build();
        }

        // 2. Parse event
        BridgerWebhookEvent event = parseEvent(payload);

        // 3. Update Trax payment status based on event
        switch (event.getEventType()) {
            case "AlertClosed":
                handleAlertClosed(event);
                break;
            case "AlertDecisionApplied":
                handleDecisionApplied(event);
                break;
        }

        return ResponseEntity.ok().build();
    }
}
```

### 7.3 Webhook Payload Processing

```json
// Incoming webhook payload
{
  "ResultId": 12345678,
  "EventType": "AlertDecisionApplied",
  "Status": "Transaction Approved",
  "State": "Closed",
  "DateModified": "2026-01-13T14:30:00Z",
  "AssignedTo": "ComplianceOfficer1",
  "DecisionTags": ["Reviewed", "FalsePositive"],
  "Note": 1
}
```

**Processing Logic:**
1. Look up payment by `ResultId` (stored during screening)
2. Map `Status` to Trax payment state transition
3. Update payment record and move to appropriate inventory
4. Log decision for audit trail

---

## 8. Error Handling and Resilience

### 8.1 Retry Strategy

```yaml
retryPolicy:
  transientErrors:
    - HTTP_503
    - HTTP_504
    - CONNECTION_TIMEOUT
    - READ_TIMEOUT
  strategy: EXPONENTIAL_BACKOFF
  maxRetries: 4
  initialDelay: 2000
  maxDelay: 16000
  multiplier: 2
```

### 8.2 Circuit Breaker

```yaml
circuitBreaker:
  enabled: true
  failureThreshold: 5
  successThreshold: 3
  timeout: 30000
  halfOpenRequests: 3
  fallback:
    action: HOLD_FOR_MANUAL
    status: EXTERNAL_SUSPECT
    alertOps: true
```

### 8.3 Error Categories

| Error Type | Handling | Trax Status |
|------------|----------|-------------|
| Auth failure | Refresh token, retry | N/A (internal) |
| Rate limit (429) | Backoff, queue | Hold in buffer |
| Server error (5xx) | Retry with backoff | `EXTERNAL_SUSPECT` |
| Validation error (400) | Log, alert ops | `EXTERNAL_SUSPECT` |
| Network timeout | Retry, then fallback | `EXTERNAL_SUSPECT` |
| Malformed response | Log, alert ops | `EXTERNAL_SUSPECT` |

---

## 9. Security Considerations

### 9.1 Credential Management

- Store Bridger credentials in Bank Connector's existing password vault
- Encrypt API keys in configuration files using the encryption tool
- Use environment variables for sensitive values in containerized deployments

### 9.2 Data Protection

- TLS 1.2+ for all API communications
- No PII stored in logs (mask names, account numbers)
- Screening results retained per data retention policy
- GDPR compliance: right to erasure handled via Bridger API

### 9.3 Access Control

- Dedicated service account for Bridger API access
- Role-based access for webhook endpoint
- IP whitelist for Bridger webhook source IPs

---

## 10. Performance Considerations

### 10.1 Throughput Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Single payment screening | < 2 seconds | Real-time path |
| Batch screening (50 payments) | < 10 seconds | Aggregated path |
| Peak throughput | 1000 payments/minute | Burst capacity |
| Sustained throughput | 500 payments/minute | Normal operations |

### 10.2 Optimization Strategies

1. **Request Batching**: Aggregate up to 100 payments per API call
2. **Response Caching**: Cache negative results for repeat parties (configurable TTL)
3. **Async Processing**: Queue high-volume batches for background processing
4. **Connection Pooling**: Maintain persistent HTTP connections

### 10.3 Caching Strategy

```yaml
cache:
  enabled: true
  provider: "local"  # or "redis" for distributed
  entries:
    clearParty:
      ttl: 3600  # 1 hour
      maxSize: 10000
    authToken:
      ttl: 3500  # Just under token expiry
      maxSize: 10
```

---

## 11. Monitoring and Observability

### 11.1 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `bridger.screening.requests` | Counter | Total screening requests |
| `bridger.screening.latency` | Histogram | Response time distribution |
| `bridger.screening.matches` | Counter | Matches found |
| `bridger.screening.errors` | Counter | API errors by type |
| `bridger.auth.refresh` | Counter | Token refreshes |
| `bridger.webhook.received` | Counter | Webhooks received |

### 11.2 Alerting

```yaml
alerts:
  - name: "Bridger API Unavailable"
    condition: "bridger.screening.errors{type='connection'} > 10 in 5m"
    severity: CRITICAL

  - name: "High Screening Latency"
    condition: "bridger.screening.latency.p95 > 5000ms"
    severity: WARNING

  - name: "Auth Token Refresh Failure"
    condition: "bridger.auth.refresh{status='failed'} > 0"
    severity: CRITICAL
```

### 11.3 Logging

```yaml
logging:
  bridger:
    level: INFO
    sensitiveFields:
      mask:
        - "name"
        - "address"
        - "dateOfBirth"
        - "ssn"
    auditEvents:
      - SCREENING_INITIATED
      - SCREENING_COMPLETED
      - MATCH_FOUND
      - DECISION_APPLIED
      - WEBHOOK_RECEIVED
```

---

## 12. Migration and Rollout Strategy

### 12.1 Phase 1: Foundation (Parallel Mode)

**Objective**: Deploy integration in shadow mode alongside existing processes

- Deploy Bridger channel in Bank Connector
- Configure for a subset of payment types (e.g., high-value only)
- Run screening in parallel; log results but don't block
- Compare results with any existing manual screening
- Tune thresholds based on observed match rates

### 12.2 Phase 2: Pilot (Controlled Rollout)

**Objective**: Enable blocking for pilot group

- Select pilot customer or payment corridor
- Enable full workflow integration
- Monitor operational metrics
- Gather compliance officer feedback
- Refine decision rules and alert assignments

### 12.3 Phase 3: General Availability

**Objective**: Full production deployment

- Expand to all applicable payment types
- Enable webhook integration
- Activate caching and performance optimizations
- Complete compliance documentation
- Train operations and compliance teams

### 12.4 Feature Flags

```yaml
featureFlags:
  bridgerScreening:
    enabled: true
    shadowMode: false  # true = log only, don't block
    paymentTypes:
      - "SWIFT_MT103"
      - "ISO20022_PACS008"
      - "EBICS_CCT"
    customerWhitelist: []  # Empty = all customers
    minimumAmount: 10000  # Screen payments above this value
```

---

## 13. Alignment with Monolith Decomposition

This design aligns with the Trax monolith decomposition roadmap:

### 13.1 Current Position

- Bank Connector already extracted as independent component
- Bridger integration adds new capability to Bank Connector
- Uses existing Integration Channel framework in Trax

### 13.2 Future Evolution

Per the decomposition plan (Phase 1-2):

1. **Config Orchestrator**: Bridger configuration will migrate to centralized config service
2. **Communication Service**: Bank Connector becomes unified Communication Service; Bridger channel is native
3. **Event-Driven**: Screening results published to Kafka for downstream consumers
4. **Multi-Tenancy**: Configuration per tenant for different screening profiles

### 13.3 Microservice Readiness

The Bridger channel is designed for eventual extraction:

```
┌────────────────────────────────────────────────────────────────┐
│                 FUTURE: SCREENING MICROSERVICE                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Compliance Screening Service                │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Bridger    │  │   Dow Jones  │  │   Refinitiv  │  │   │
│  │  │   Adapter    │  │   Adapter    │  │   Adapter    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │              Unified Screening API                  │ │   │
│  │  │  - Provider abstraction                             │ │   │
│  │  │  - Configurable routing                             │ │   │
│  │  │  - Result aggregation                               │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  Events: SCREENING_REQUESTED, SCREENING_COMPLETED        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 14. Open Questions for Discussion

1. **Screening Scope**: Should we screen all parties (debtor, creditor, intermediaries) or only primary parties initially?

2. **Real-time vs. Batch**: For high-volume customers, should we support a batch mode that screens payments asynchronously overnight?

3. **Alert Assignment**: How should Bridger alerts be assigned? By customer, by payment type, or by match severity?

4. **False Positive Handling**: Should we implement auto-accept logic for repeat false positives (accept list integration)?

5. **Multi-Provider Support**: Should the architecture support plugging in alternative screening providers (Dow Jones, Refinitiv) from day one?

6. **STP Rate Target**: What is the acceptable Straight-Through Processing rate? (Industry standard: 85-95%)

7. **Compliance Reporting**: What specific reports are required for regulatory purposes?

---

## 15. Appendix

### A. Bridger API Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/Token/Issue` | Obtain JWT token |
| POST | `/api/Lists/Search` | Perform screening search |
| POST | `/api/Lists/DataFiles` | List available screening lists |
| POST | `/api/Results/Record` | Get single alert |
| POST | `/api/Results/Records` | Get multiple alerts |
| POST | `/api/Results/SetRecordState` | Update alert status |
| POST | `/api/ListMaintenance/AddList` | Create custom list |
| POST | `/api/ListMaintenance/AddRecord` | Add to custom list |

### B. Sample Configuration File

```yaml
# bridger-config.yml
bridger:
  api:
    baseUrl: ${BRIDGER_BASE_URL:https://xg.bridger.example.com/LN.WebServices}
    clientId: ${BRIDGER_CLIENT_ID}
    userId: ${BRIDGER_USER_ID}
    password: ${BRIDGER_PASSWORD}
    apiKey: ${BRIDGER_API_KEY}

  token:
    refreshBeforeExpiry: 300  # Refresh 5 minutes before expiry

  search:
    predefinedSearchName: ${BRIDGER_SEARCH_NAME:PaymentScreening}
    writeResultsToDatabase: true
    assignTo:
      division: ${BRIDGER_DIVISION:Compliance}
      type: Role
      rolesOrUsers:
        - ComplianceOfficer
    duplicateMatchSuppression: true

  thresholds:
    autoAccept:
      enabled: true
      maxScore: 30
    autoReject:
      enabled: true
      minScore: 95
    review:
      minScore: 31
      maxScore: 94

  batch:
    enabled: true
    maxSize: 50
    maxWait: 5000

  cache:
    enabled: true
    clearPartyTtl: 3600

  webhook:
    enabled: true
    path: /api/bridger/webhook
    hmacSecret: ${BRIDGER_WEBHOOK_SECRET}

  retry:
    maxAttempts: 3
    initialDelay: 2000
    multiplier: 2
    maxDelay: 16000

  circuitBreaker:
    enabled: true
    failureThreshold: 5
    timeout: 30000
```

### C. Trax Integration Channel Configuration

```yaml
# integration-channel-bridger.yml
channel:
  name: BRIDGER
  type: INTEGRATION_CHANNEL

profiles:
  - name: BRIDGER_SCREENING
    direction: OUTGOING
    targetConnection:
      type: REST
      baseUrl: ${bridger.api.baseUrl}
      authentication:
        type: JWT
        tokenEndpoint: /api/Token/Issue
    requestTemplate: bridger-search-request.ftl
    responseHandler: bridger-screening-response-handler

responseSubscriptions:
  - name: BRIDGER_ALERT_UPDATE
    eventType: WEBHOOK
    endpoint: /api/bridger/webhook
    handler: bridger-webhook-handler
```

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-13 | Claude | Initial design document |
