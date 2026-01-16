# Bank Connector Webhooks Support Design

## Generic Webhook Framework for External Provider Integrations

**Version:** 1.0
**Date:** 2026-01-13
**Status:** Design Proposal

---

## 1. Executive Summary

This document defines the design for adding generic webhook support to Bank Connector, enabling the system to receive and process real-time notifications from external providers. The design uses LexisNexis Bridger Insight XG5 webhooks as the primary implementation target while establishing a flexible framework that supports webhooks from any third-party provider (banks, compliance services, messaging networks, etc.).

### Key Objectives

1. **Unified Webhook Framework**: Single, extensible architecture for receiving webhooks from any external provider
2. **Security-First Design**: Robust signature validation, replay protection, and audit logging
3. **Provider Abstraction**: Plugin architecture allowing new providers without core changes
4. **Operational Excellence**: Comprehensive monitoring, alerting, and troubleshooting capabilities
5. **Trax Integration**: Seamless state updates and event propagation to the payment hub

---

## 2. Problem Statement

### Current State

Bank Connector currently operates in a **request-response** model where it initiates all communications with external systems. This creates limitations:

- **Polling Overhead**: Must periodically poll for status updates
- **Delayed Updates**: State changes not reflected until next poll cycle
- **Inefficient Resource Usage**: Continuous polling consumes API quotas and compute
- **Poor Responsiveness**: Manual review decisions in compliance systems delayed

### Target State

Enable **push-based notifications** where external providers notify Bank Connector of state changes in real-time:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CURRENT STATE vs TARGET STATE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CURRENT: Poll-Based                    TARGET: Webhook-Based                │
│  ═══════════════════                    ═════════════════════                │
│                                                                              │
│  Bank Connector                         Bank Connector                       │
│       │                                      │                               │
│       │──► GET /status ──►│                  │◄── POST /webhook ◄──│        │
│       │◄── (no change) ◄──│                  │                      │        │
│       │                   │                  │    Event occurs      │        │
│       │──► GET /status ──►│  External        │    at External       │        │
│       │◄── (no change) ◄──│  Provider        │◄── Provider pushes ◄─│        │
│       │                   │                  │    notification      │        │
│       │──► GET /status ──►│                  │                      │        │
│       │◄── (changed!) ◄───│                  │    Real-time update  │        │
│       │                   │                  │                               │
│                                                                              │
│  ❌ 3 API calls for 1 update            ✓ 1 call, instant update            │
│  ❌ Delayed by poll interval            ✓ Sub-second latency                 │
│  ❌ Wastes API quota                    ✓ Efficient resource use             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Use Cases

### 3.1 Primary Use Case: Bridger Compliance Webhooks

LexisNexis Bridger Insight XG5 sends webhooks when compliance officers make decisions on screening alerts:

| Event Type | Trigger | Bank Connector Action |
|------------|---------|----------------------|
| `AlertStateClosed` | Alert closed with final decision | Update payment to `EXTERNAL_ACCEPTED` or `EXTERNAL_REJECTED` |
| `AlertDecisionApplied` | Decision applied (approval, rejection, note added) | Update payment status, log decision details |

**Example Flow:**

```
1. Payment screened → Matches found → Status: EXTERNAL_SUSPECT
2. Compliance officer reviews in Bridger UI
3. Officer approves (false positive determination)
4. Bridger sends AlertDecisionApplied webhook
5. Bank Connector receives, validates, processes
6. Trax payment status → EXTERNAL_ACCEPTED
7. Payment continues to release
```

### 3.2 Future Use Cases

| Provider | Webhook Events | Business Value |
|----------|---------------|----------------|
| **Banks (SWIFT gpi)** | Payment status updates, confirmations | Real-time tracking, SLA monitoring |
| **SWIFT** | Message acknowledgments, NAKs | Immediate error handling |
| **Dow Jones Risk** | Screening result updates | Multi-provider compliance |
| **Refinitiv WCO** | Alert closures, list updates | Alternative screening integration |
| **EBICS Banks** | Statement availability, pain.002 | Faster reconciliation |
| **FX Providers** | Rate locks, trade confirmations | Treasury automation |

### 3.3 Column Banking Platform Webhooks

Column is a nationally chartered platform bank built for developers, offering direct Federal Reserve connections and comprehensive banking APIs for ACH, Wire, SWIFT, Real-time payments (RTP/FedNow), and book transfers. This use case details the integration of Column webhooks into Bank Connector to enable real-time payment status updates, account notifications, and compliance event handling.

#### 3.3.1 Business Context

Column provides a modern banking-as-a-service platform that enables:

- **Direct Federal Reserve access**: Fastest possible ACH and wire transfers
- **24/7 instant book transfers**: Real-time internal transfers between Column accounts
- **Real-time payments**: FedNow and RTP network access settling in under a second
- **International payments**: Direct SWIFT network integration
- **Programmable accounts**: Full API control over bank accounts and entities

**Integration Value for Bank Connector:**

| Capability | Current State | With Column Webhooks |
|------------|---------------|----------------------|
| ACH Status | Poll every 15 minutes | Real-time within seconds |
| Wire Confirmation | Manual reconciliation | Instant notification |
| SWIFT Updates | Batch processing | Real-time status tracking |
| Book Transfers | Synchronous only | Async with hold management |
| Compliance | Separate workflow | Integrated identity events |

#### 3.3.2 Column Webhook Event Categories

Column provides comprehensive webhook coverage across all payment rails and account operations:

##### Payment Transfer Events

| Event Category | Event Type | Description | Webhook |
|----------------|------------|-------------|---------|
| **ACH Outgoing** | `ach.outgoing_transfer.initiated` | Transfer request received | Yes |
| | `ach.outgoing_transfer.manual_review` | Under Column team review | Yes |
| | `ach.outgoing_transfer.submitted` | Submitted to Federal Reserve | Yes |
| | `ach.outgoing_transfer.settled` | Settled at receiving bank (RDFI) | Yes |
| | `ach.outgoing_transfer.completed` | Return window passed | Yes |
| | `ach.outgoing_transfer.returned` | Returned by RDFI | Yes |
| | `ach.outgoing_transfer.noc` | Notification of Change received | Yes |
| **ACH Incoming** | `ach.incoming_transfer.completed` | Return window passed | Yes |
| | `ach.incoming_transfer.returned` | Returned by Column | Yes |
| | `ach.incoming_transfer.return_dishonored` | Return dishonored by ODFI | Yes |
| | `ach.incoming_transfer.return_contested` | Dishonored return contested | Yes |
| **Wire Outgoing** | `wire.outgoing_transfer.initiated` | Wire request received | Yes |
| | `wire.outgoing_transfer.manual_review` | Under Column team review | Yes |
| | `wire.outgoing_transfer.submitted` | Submitted to Federal Reserve | Yes |
| | `wire.outgoing_transfer.rejected` | Rejected by Column or Fed | Yes |
| | `wire.outgoing_transfer.completed` | Fed acknowledgment received | Yes |
| **Wire Incoming** | `wire.incoming_transfer.completed` | Incoming wire processed | Yes |
| **SWIFT Outgoing** | `swift.outgoing_transfer.initiated` | SWIFT request received | Yes |
| | `swift.outgoing_transfer.manual_review` | Under Column review | Yes |
| | `swift.outgoing_transfer.submitted` | Submitted to SWIFT network | Yes |
| | `swift.outgoing_transfer.completed` | Settled to beneficiary bank | Yes |
| | `swift.outgoing_transfer.pending_return` | Return confirmation received | Yes |
| | `swift.outgoing_transfer.returned` | Returned/rejected | Yes |
| **Book Transfer** | `book.transfer.completed` | Internal transfer completed | Yes |
| | `book.transfer.hold_created` | Transfer with hold created | Yes |
| | `book.transfer.updated` | Held transfer updated | Yes |
| | `book.transfer.canceled` | Held transfer canceled | Yes |
| **Real-time** | `realtime.outgoing_transfer.initiated` | RTP/FedNow initiated | Yes |
| | `realtime.outgoing_transfer.completed` | Settled (sub-second) | Yes |
| | `realtime.outgoing_transfer.rejected` | Rejected by network | Yes |
| | `realtime.incoming_transfer.completed` | Incoming RTP received | Yes |

##### Account and Entity Events

| Event Category | Event Type | Description |
|----------------|------------|-------------|
| **Account** | `account.overdrafted` | Account overdrawn, reserve locked |
| | `account.overdraft_cleared` | Overdraft cleared, reserve released |
| **Identity** | `identity.created` | Entity created, pending verification |
| | `identity.verification.pending` | Verification submitted |
| | `identity.verification.manual_review` | Under manual review |
| | `identity.verification.verified` | Identity verified successfully |
| | `identity.verification.denied` | Verification failed |
| **Loan** | `loan.created` | Loan created |
| | `loan.updated` | Loan updated |
| | `loan.in_dispute` | Loan marked in dispute |
| | `loan.delinquent` | Loan marked delinquent |
| | `loan.payment.completed` | Loan payment completed |
| **Reporting** | `reporting.bank_account_summary.completed` | Account summary ready |
| | `reporting.bank_account_transaction.completed` | Transaction report ready |

#### 3.3.3 Example Integration Flow

**Scenario: ACH Payment with Real-time Status Updates**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               COLUMN ACH PAYMENT WEBHOOK INTEGRATION FLOW                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Payment Initiation                                                       │
│  ═══════════════════                                                         │
│                                                                              │
│  Trax                    Bank Connector              Column API              │
│    │                           │                          │                  │
│    │── Create ACH Payment ────►│                          │                  │
│    │                           │── POST /transfers/ach ──►│                  │
│    │                           │◄── 201 {id, status} ─────│                  │
│    │◄── PENDING ───────────────│                          │                  │
│                                                                              │
│  2. Real-time Status Updates via Webhooks                                    │
│  ════════════════════════════════════════                                    │
│                                                                              │
│  Column                  Bank Connector              Trax                    │
│    │                           │                       │                     │
│    │── ach.outgoing_transfer  ─►│                      │                     │
│    │   .submitted              │── Validate signature  │                     │
│    │                           │── Update payment ────►│                     │
│    │                           │   status: SUBMITTED   │                     │
│    │◄── 200 OK ────────────────│                       │                     │
│    │                           │                       │                     │
│    │── ach.outgoing_transfer  ─►│                      │                     │
│    │   .settled                │── Validate signature  │                     │
│    │                           │── Update payment ────►│                     │
│    │                           │   status: SETTLED     │                     │
│    │◄── 200 OK ────────────────│                       │                     │
│    │                           │                       │                     │
│    │── ach.outgoing_transfer  ─►│                      │                     │
│    │   .completed              │── Validate signature  │                     │
│    │                           │── Update payment ────►│                     │
│    │                           │   status: COMPLETED   │                     │
│    │◄── 200 OK ────────────────│                       │                     │
│                                                                              │
│  3. Exception Handling (Return Scenario)                                     │
│  ═══════════════════════════════════════                                     │
│                                                                              │
│  Column                  Bank Connector              Trax                    │
│    │                           │                       │                     │
│    │── ach.outgoing_transfer  ─►│                      │                     │
│    │   .returned               │── Validate signature  │                     │
│    │   {return_code: "R01"}    │── Update payment ────►│                     │
│    │                           │   status: RETURNED    │                     │
│    │                           │   reason: "R01"       │                     │
│    │◄── 200 OK ────────────────│                       │                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Scenario: SWIFT International Transfer**

```
1. Trax initiates international payment → Bank Connector → Column API
2. Column sends swift.outgoing_transfer.initiated webhook
3. Bank Connector validates, updates Trax: status = SWIFT_INITIATED
4. Column sends swift.outgoing_transfer.submitted webhook
5. Bank Connector updates Trax: status = SWIFT_SUBMITTED
6. Column sends swift.outgoing_transfer.completed webhook
7. Bank Connector updates Trax: status = SWIFT_COMPLETED
   (Or swift.outgoing_transfer.returned if rejected by correspondent bank)
```

#### 3.3.4 Column Signature Validation

Column uses HMAC-SHA256 to sign webhook payloads with a unique secret per endpoint:

**Signature Details:**

| Aspect | Value |
|--------|-------|
| Algorithm | HMAC-SHA256 |
| Header | `Column-Signature` |
| Secret Source | Dashboard → Webhook settings (unique per endpoint) |
| Input | Raw JSON payload (unmodified) |

**Validation Implementation:**

```java
@Component
public class ColumnSignatureValidator implements WebhookSignatureValidator {

    private final String webhookSecret;

    public ColumnSignatureValidator(
            @Value("${webhooks.providers.column.webhookSecret}") String secret) {
        this.webhookSecret = secret;
    }

    @Override
    public ValidationResult validate(WebhookRequest request) {
        try {
            // Step 1: Get signature from header
            String providedSignature = request.getHeader("Column-Signature");
            if (providedSignature == null || providedSignature.isEmpty()) {
                return ValidationResult.failure(
                    "MISSING_SIGNATURE",
                    "Column-Signature header is missing"
                );
            }

            // Step 2: Compute expected signature using raw payload
            // CRITICAL: Use raw payload without any modification
            String rawPayload = request.getRawBody();
            String expectedSignature = computeHmacSha256(webhookSecret, rawPayload);

            // Step 3: Compare signatures using constant-time comparison
            if (!constantTimeEquals(expectedSignature, providedSignature)) {
                return ValidationResult.failure(
                    "SIGNATURE_MISMATCH",
                    "Column-Signature validation failed"
                );
            }

            return ValidationResult.success();

        } catch (Exception e) {
            return ValidationResult.failure(
                "VALIDATION_ERROR",
                "Error during signature validation: " + e.getMessage()
            );
        }
    }

    private String computeHmacSha256(String secret, String message) {
        Mac hmac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(
            secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"
        );
        hmac.init(keySpec);
        byte[] hash = hmac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        return Hex.encodeHexString(hash);  // Or Base64 depending on Column's format
    }

    @Override
    public String getProviderName() {
        return "column";
    }
}
```

**Important Considerations:**

1. **Raw Payload Requirement**: Column requires the exact raw payload bytes for signature calculation. Any prettifying, deserializing/serializing, or whitespace changes will cause validation failures.

2. **Per-Endpoint Secrets**: Each webhook endpoint configured in Column Dashboard receives a unique secret. Store and manage these securely.

3. **Response Time**: Column expects a 2XX response within **10 seconds** or will consider the delivery failed.

#### 3.3.5 Column Retry Policy

Column has a robust retry mechanism for failed webhook deliveries:

| Parameter | Value |
|-----------|-------|
| Max Retries | 25 attempts |
| Retry Window | 3 days |
| Backoff Strategy | Exponential |
| First Retry | 1 minute after failure |
| Success Criteria | 2XX HTTP response within 10 seconds |

**Best Practice Response Pattern:**

```java
@Component
public class ColumnWebhookHandler {

    public Mono<ServerResponse> handle(ServerRequest request) {
        return request.bodyToMono(String.class)
            .flatMap(body -> {
                // 1. Validate signature immediately
                ValidationResult validation = signatureValidator.validate(
                    WebhookRequest.from(request, body)
                );

                if (!validation.valid()) {
                    return ServerResponse.status(401)
                        .bodyValue(Map.of("error", validation.errorCode()));
                }

                // 2. Parse event to extract ID for idempotency
                ColumnWebhookEvent event = parseEvent(body);

                // 3. Check idempotency (Column may send same event multiple times)
                if (idempotencyStore.isDuplicate(event.getId())) {
                    return ServerResponse.ok().build();  // ACK duplicate
                }

                // 4. Return 200 OK IMMEDIATELY before processing
                // This prevents timeout and unnecessary retries
                // Process asynchronously
                processEventAsync(event, body);

                return ServerResponse.ok().build();
            });
    }

    @Async
    private void processEventAsync(ColumnWebhookEvent event, String rawPayload) {
        try {
            // Actual business logic processing
            dispatchEvent(event);
            idempotencyStore.markProcessed(event.getId());
            auditLogger.logSuccess(event);
        } catch (Exception e) {
            // Log error but don't affect webhook response
            auditLogger.logProcessingError(event, e);
            deadLetterQueue.store(event, rawPayload, e);
        }
    }
}
```

#### 3.3.6 Column Event Handler Implementation

```java
@Component
public class ColumnEventHandler implements WebhookEventHandler {

    private final PaymentStateUpdater stateUpdater;
    private final AccountEventProcessor accountProcessor;
    private final ComplianceEventProcessor complianceProcessor;
    private final WebhookAuditLogger auditLogger;

    public void handleEvent(ColumnWebhookEvent event) {
        String eventType = event.getType();

        // Route by event category
        if (eventType.startsWith("ach.")) {
            handleAchEvent(event);
        } else if (eventType.startsWith("wire.")) {
            handleWireEvent(event);
        } else if (eventType.startsWith("swift.")) {
            handleSwiftEvent(event);
        } else if (eventType.startsWith("book.")) {
            handleBookTransferEvent(event);
        } else if (eventType.startsWith("realtime.")) {
            handleRealtimeEvent(event);
        } else if (eventType.startsWith("account.")) {
            handleAccountEvent(event);
        } else if (eventType.startsWith("identity.")) {
            handleIdentityEvent(event);
        } else if (eventType.startsWith("loan.")) {
            handleLoanEvent(event);
        } else {
            log.warn("Unhandled Column event type: {}", eventType);
        }
    }

    private void handleAchEvent(ColumnWebhookEvent event) {
        String transferId = event.getData().get("id").toString();
        String paymentRef = lookupPaymentByColumnTransferId(transferId);

        if (paymentRef == null) {
            log.warn("No payment found for Column transfer: {}", transferId);
            return;
        }

        String traxStatus = mapColumnAchStatusToTrax(event.getType(), event.getData());

        stateUpdater.updatePaymentStatus(
            paymentRef,
            traxStatus,
            buildAuditDetails(event)
        );
    }

    private String mapColumnAchStatusToTrax(String eventType, Map<String, Object> data) {
        return switch (eventType) {
            case "ach.outgoing_transfer.initiated" -> "ACH_INITIATED";
            case "ach.outgoing_transfer.manual_review" -> "ACH_MANUAL_REVIEW";
            case "ach.outgoing_transfer.submitted" -> "ACH_SUBMITTED";
            case "ach.outgoing_transfer.settled" -> "ACH_SETTLED";
            case "ach.outgoing_transfer.completed" -> "ACH_COMPLETED";
            case "ach.outgoing_transfer.returned" -> {
                String returnCode = extractReturnCode(data);
                yield "ACH_RETURNED_" + returnCode;
            }
            case "ach.outgoing_transfer.noc" -> "ACH_NOC_RECEIVED";
            case "ach.incoming_transfer.completed" -> "ACH_INCOMING_COMPLETED";
            default -> {
                log.warn("Unmapped ACH event type: {}", eventType);
                yield "ACH_UNKNOWN";
            }
        };
    }

    private void handleSwiftEvent(ColumnWebhookEvent event) {
        String transferId = event.getData().get("id").toString();
        String paymentRef = lookupPaymentByColumnTransferId(transferId);

        String traxStatus = switch (event.getType()) {
            case "swift.outgoing_transfer.initiated" -> "SWIFT_INITIATED";
            case "swift.outgoing_transfer.manual_review" -> "SWIFT_MANUAL_REVIEW";
            case "swift.outgoing_transfer.submitted" -> "SWIFT_SUBMITTED";
            case "swift.outgoing_transfer.completed" -> "SWIFT_COMPLETED";
            case "swift.outgoing_transfer.pending_return" -> "SWIFT_PENDING_RETURN";
            case "swift.outgoing_transfer.returned" -> "SWIFT_RETURNED";
            default -> "SWIFT_UNKNOWN";
        };

        stateUpdater.updatePaymentStatus(paymentRef, traxStatus, buildAuditDetails(event));
    }

    private void handleAccountEvent(ColumnWebhookEvent event) {
        // Handle overdraft alerts - critical for treasury management
        if ("account.overdrafted".equals(event.getType())) {
            String accountId = event.getData().get("bank_account_id").toString();
            BigDecimal overdraftAmount = new BigDecimal(
                event.getData().get("overdraft_amount").toString()
            );

            accountProcessor.handleOverdraft(accountId, overdraftAmount, event);
            // Trigger alert to treasury team
            alertService.sendOverdraftAlert(accountId, overdraftAmount);
        }
    }

    private void handleIdentityEvent(ColumnWebhookEvent event) {
        // Handle KYC/identity verification events for compliance
        String entityId = event.getData().get("entity_id").toString();

        switch (event.getType()) {
            case "identity.verification.verified" ->
                complianceProcessor.markEntityVerified(entityId, event);
            case "identity.verification.denied" ->
                complianceProcessor.markEntityDenied(entityId, event);
            case "identity.verification.manual_review" ->
                complianceProcessor.flagForManualReview(entityId, event);
        }
    }
}
```

#### 3.3.7 Column Status Mapping

##### ACH Transfer Status Mapping

| Column Event | Trax Status | Payment Action |
|--------------|-------------|----------------|
| `ach.outgoing_transfer.initiated` | `ACH_INITIATED` | Payment in progress |
| `ach.outgoing_transfer.manual_review` | `ACH_MANUAL_REVIEW` | Await Column review |
| `ach.outgoing_transfer.submitted` | `ACH_SUBMITTED` | Sent to Federal Reserve |
| `ach.outgoing_transfer.settled` | `ACH_SETTLED` | Funds settled at RDFI |
| `ach.outgoing_transfer.completed` | `ACH_COMPLETED` | Final - return window closed |
| `ach.outgoing_transfer.returned` | `ACH_RETURNED` | Handle return, notify user |
| `ach.outgoing_transfer.noc` | `ACH_NOC_RECEIVED` | Update account details |

##### Wire Transfer Status Mapping

| Column Event | Trax Status | Payment Action |
|--------------|-------------|----------------|
| `wire.outgoing_transfer.initiated` | `WIRE_INITIATED` | Payment in progress |
| `wire.outgoing_transfer.manual_review` | `WIRE_MANUAL_REVIEW` | Await Column review |
| `wire.outgoing_transfer.submitted` | `WIRE_SUBMITTED` | Sent to FedWire |
| `wire.outgoing_transfer.completed` | `WIRE_COMPLETED` | Final - wire delivered |
| `wire.outgoing_transfer.rejected` | `WIRE_REJECTED` | Handle rejection |
| `wire.incoming_transfer.completed` | `WIRE_INCOMING_RECEIVED` | Credit account |

##### SWIFT Transfer Status Mapping

| Column Event | Trax Status | Payment Action |
|--------------|-------------|----------------|
| `swift.outgoing_transfer.initiated` | `SWIFT_INITIATED` | Payment in progress |
| `swift.outgoing_transfer.manual_review` | `SWIFT_MANUAL_REVIEW` | Await Column review |
| `swift.outgoing_transfer.submitted` | `SWIFT_SUBMITTED` | Sent to SWIFT network |
| `swift.outgoing_transfer.completed` | `SWIFT_COMPLETED` | Delivered to beneficiary bank |
| `swift.outgoing_transfer.pending_return` | `SWIFT_PENDING_RETURN` | Return incoming |
| `swift.outgoing_transfer.returned` | `SWIFT_RETURNED` | Handle return/rejection |

#### 3.3.8 Column Webhook Payload Examples

**ACH Outgoing Transfer Completed:**

```json
{
  "id": "evnt_2abc3def4ghi5jkl",
  "type": "ach.outgoing_transfer.completed",
  "created_at": "2026-01-15T14:30:00.000Z",
  "data": {
    "id": "acht_1abc2def3ghi4jkl",
    "amount": 150000,
    "currency_code": "USD",
    "type": "credit",
    "status": "completed",
    "description": "Vendor payment",
    "entry_class_code": "CCD",
    "bank_account_id": "bacc_abc123def456",
    "counterparty_id": "cprt_xyz789abc012",
    "created_at": "2026-01-14T10:00:00.000Z",
    "updated_at": "2026-01-15T14:30:00.000Z",
    "effective_date": "2026-01-15",
    "settlement_date": "2026-01-15"
  }
}
```

**ACH Transfer Returned:**

```json
{
  "id": "evnt_3def4ghi5jkl6mno",
  "type": "ach.outgoing_transfer.returned",
  "created_at": "2026-01-16T09:15:00.000Z",
  "data": {
    "id": "acht_2def3ghi4jkl5mno",
    "amount": 50000,
    "currency_code": "USD",
    "type": "credit",
    "status": "returned",
    "bank_account_id": "bacc_abc123def456",
    "return_details": {
      "return_code": "R01",
      "return_reason": "Insufficient Funds",
      "returned_at": "2026-01-16T09:15:00.000Z"
    }
  }
}
```

**SWIFT Transfer Completed:**

```json
{
  "id": "evnt_4ghi5jkl6mno7pqr",
  "type": "swift.outgoing_transfer.completed",
  "created_at": "2026-01-15T16:45:00.000Z",
  "data": {
    "id": "swft_3ghi4jkl5mno6pqr",
    "amount": 25000000,
    "currency_code": "EUR",
    "status": "completed",
    "bank_account_id": "bacc_abc123def456",
    "beneficiary_name": "Acme GmbH",
    "beneficiary_bank_bic": "DEUTDEFF",
    "beneficiary_account_number": "DE89370400440532013000",
    "reference": "INV-2026-00123",
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T16:45:00.000Z"
  }
}
```

**Account Overdraft Alert:**

```json
{
  "id": "evnt_5jkl6mno7pqr8stu",
  "type": "account.overdrafted",
  "created_at": "2026-01-15T11:30:00.000Z",
  "data": {
    "bank_account_id": "bacc_xyz789abc012",
    "platform_id": "plat_main123",
    "overdraft_amount": 500000,
    "available_balance": -500000,
    "reserve_account_id": "bacc_reserve456",
    "locked_reserve_amount": 500000
  }
}
```

#### 3.3.9 Column Provider Configuration

```yaml
# column-webhook-config.yml
webhooks:
  providers:
    column:
      enabled: true
      path: /api/webhooks/column

      security:
        signatureType: HMAC_SHA256
        signatureHeader: Column-Signature
        webhookSecret: ${COLUMN_WEBHOOK_SECRET}
        # Column doesn't publish IP ranges for allowlisting
        # Use signature validation as primary security

      eventHandling:
        # Use wildcard to receive all events
        subscribedEvents:
          - "*"  # All events
          # Or be selective:
          # - "ach.*"
          # - "wire.*"
          # - "swift.*"
          # - "account.overdrafted"
          # - "identity.verification.*"

        # Event type to Trax status mapping
        achStatusMapping:
          "ach.outgoing_transfer.initiated": ACH_INITIATED
          "ach.outgoing_transfer.manual_review": ACH_MANUAL_REVIEW
          "ach.outgoing_transfer.submitted": ACH_SUBMITTED
          "ach.outgoing_transfer.settled": ACH_SETTLED
          "ach.outgoing_transfer.completed": ACH_COMPLETED
          "ach.outgoing_transfer.returned": ACH_RETURNED

        wireStatusMapping:
          "wire.outgoing_transfer.initiated": WIRE_INITIATED
          "wire.outgoing_transfer.submitted": WIRE_SUBMITTED
          "wire.outgoing_transfer.completed": WIRE_COMPLETED
          "wire.outgoing_transfer.rejected": WIRE_REJECTED

        swiftStatusMapping:
          "swift.outgoing_transfer.initiated": SWIFT_INITIATED
          "swift.outgoing_transfer.submitted": SWIFT_SUBMITTED
          "swift.outgoing_transfer.completed": SWIFT_COMPLETED
          "swift.outgoing_transfer.returned": SWIFT_RETURNED

      responseHandling:
        # Return 200 immediately, process async
        asyncProcessing: true
        responseTimeoutMs: 5000  # Well under Column's 10s limit

      idempotency:
        keyField: "id"  # Column event ID
        ttlHours: 72    # Cover Column's 3-day retry window

      traxIntegration:
        updatePaymentStatus: true
        createAuditLog: true
        notifyTreasury: true  # For overdraft alerts
        notifyCompliance: true  # For identity events

      alerts:
        onOverdraft: true
        onSwiftReturn: true
        onManualReview: true
```

#### 3.3.10 Column Plugin Implementation

```java
@Component
public class ColumnWebhookPlugin implements WebhookProviderPlugin {

    private final ColumnSignatureValidator signatureValidator;
    private final ColumnEventProcessor eventProcessor;
    private final ColumnEventHandler eventHandler;
    private final ColumnWebhookConfig config;

    @Override
    public String getProviderId() {
        return "column";
    }

    @Override
    public String getProviderName() {
        return "Column Banking Platform";
    }

    @Override
    public WebhookSignatureValidator getSignatureValidator() {
        return signatureValidator;
    }

    @Override
    public WebhookEventProcessor<?> getEventProcessor() {
        return eventProcessor;
    }

    @Override
    public WebhookEventHandler getEventHandler() {
        return eventHandler;
    }

    @Override
    public ConfigurationSchema getConfigurationSchema() {
        return ConfigurationSchema.builder()
            .requiredString("webhookSecret", "Column webhook signing secret")
            .requiredString("platformId", "Column platform identifier")
            .optionalBoolean("asyncProcessing", true, "Process events asynchronously")
            .optionalStringArray("subscribedEvents", List.of("*"), "Events to subscribe to")
            .optionalBoolean("notifyTreasury", true, "Alert on overdraft events")
            .optionalBoolean("notifyCompliance", true, "Alert on identity events")
            .build();
    }
}
```

#### 3.3.11 Key Implementation Considerations

**1. Event Ordering**

Column explicitly states that events may not be delivered in order. Bank Connector must:
- Not assume sequential delivery
- Handle events based on their `created_at` timestamp
- Use the transfer object's `status` field as the source of truth
- Implement proper state machine transitions that handle out-of-order events

**2. Idempotency Requirements**

Column may deliver the same event multiple times. Implementation must:
- Store processed event IDs for at least 72 hours (covering 3-day retry window)
- Use Column's event `id` field as the idempotency key
- Return 200 OK for duplicate events without reprocessing

**3. Response Time Constraints**

Column requires 2XX response within 10 seconds:
- Validate signature immediately
- Return 200 OK before any business logic processing
- Process events asynchronously
- Use dead letter queue for failed async processing

**4. ACH Return Code Handling**

ACH returns include standardized return codes that require specific handling:

| Return Code | Meaning | Action |
|-------------|---------|--------|
| R01 | Insufficient Funds | Retry or notify payer |
| R02 | Account Closed | Update counterparty, notify payer |
| R03 | No Account/Unable to Locate | Verify account details |
| R04 | Invalid Account Number | Update counterparty details |
| R10 | Customer Advises Not Authorized | Dispute handling |
| R29 | Corporate Customer Advises Not Authorized | Dispute handling |

**5. Manual Review Events**

When Column places a transfer in manual review:
- Do not update payment to a failed state
- Set status to indicate pending review
- Column team will either approve (next event) or reject
- May take up to 24-48 hours during business days

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BANK CONNECTOR WEBHOOK ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                           EXTERNAL PROVIDERS                                 │
│                                                                              │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│    │ Bridger  │  │  Column  │  │  SWIFT   │  │ Dow Jones│  │  Banks   │  │
│    │   XG5    │  │  Bank    │  │   gpi    │  │   Risk   │  │          │  │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│         │               │               │               │                   │
│         └───────────────┴───────────────┴───────────────┘                   │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     WEBHOOK GATEWAY LAYER                            │   │
│  │                                                                      │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │   │
│  │  │ Load Balancer  │  │  Rate Limiter  │  │  IP Allowlist Filter   │ │   │
│  │  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘ │   │
│  │          └───────────────────┴───────────────────────┘              │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     WEBHOOK RECEIVER SERVICE                         │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                    PROVIDER ROUTER                            │  │   │
│  │  │  /api/webhooks/bridger    → BridgerWebhookHandler            │  │   │
│  │  │  /api/webhooks/column     → ColumnWebhookHandler             │  │   │
│  │  │  /api/webhooks/swift-gpi  → SwiftGpiWebhookHandler           │  │   │
│  │  │  /api/webhooks/dow-jones  → DowJonesWebhookHandler           │  │   │
│  │  │  /api/webhooks/{provider} → DynamicProviderHandler           │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                  SIGNATURE VALIDATORS                         │  │   │
│  │  │                                                               │  │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │   │
│  │  │  │HMAC-SHA256  │  │  RSA/ECDSA  │  │ Custom Validators   │  │  │   │
│  │  │  │(Bridger)    │  │  (JWT)      │  │ (Per Provider)      │  │  │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                   EVENT PROCESSOR                             │  │   │
│  │  │                                                               │  │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │   │
│  │  │  │  Payload    │  │  Event      │  │  Idempotency        │  │  │   │
│  │  │  │  Parser     │  │  Mapper     │  │  Guard              │  │  │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     EVENT DISPATCHER                                 │   │
│  │                                                                      │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │   │
│  │  │ Trax State     │  │  Audit Log     │  │  Event Bus Publisher   │ │   │
│  │  │ Updater        │  │  Writer        │  │  (Future: Kafka)       │ │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Design

#### 4.2.1 Webhook Gateway Layer

The gateway provides network-level protection before requests reach application code:

```yaml
webhookGateway:
  loadBalancer:
    type: round-robin
    healthCheck:
      path: /health
      interval: 10s

  rateLimiter:
    enabled: true
    global:
      requestsPerSecond: 100
      burstSize: 200
    perProvider:
      bridger:
        requestsPerSecond: 50
        burstSize: 100

  ipAllowlist:
    enabled: true
    providers:
      bridger:
        # LexisNexis IP ranges (provided by LN Risk Solutions)
        - 52.xxx.xxx.0/24
        - 52.xxx.xxx.0/24
      swift:
        - 10.xxx.xxx.0/16  # SWIFT network ranges
```

#### 4.2.2 Provider Router

Routes incoming webhooks to the appropriate handler based on URL path:

```java
@Configuration
public class WebhookRouterConfig {

    @Bean
    public RouterFunction<ServerResponse> webhookRouter(
            BridgerWebhookHandler bridgerHandler,
            ColumnWebhookHandler columnHandler,
            SwiftGpiWebhookHandler swiftHandler,
            GenericWebhookHandler genericHandler) {

        return RouterFunctions
            .route(POST("/api/webhooks/bridger"), bridgerHandler::handle)
            .andRoute(POST("/api/webhooks/column"), columnHandler::handle)
            .andRoute(POST("/api/webhooks/swift-gpi"), swiftHandler::handle)
            .andRoute(POST("/api/webhooks/{provider}"), genericHandler::handle);
    }
}
```

#### 4.2.3 Signature Validator Interface

Provider-specific signature validation with a common interface:

```java
public interface WebhookSignatureValidator {

    /**
     * Validate the webhook request signature.
     *
     * @param request The incoming webhook request
     * @return ValidationResult with success/failure and error details
     */
    ValidationResult validate(WebhookRequest request);

    /**
     * Get the provider this validator handles.
     */
    String getProviderName();
}

public record ValidationResult(
    boolean valid,
    String errorCode,
    String errorMessage,
    Map<String, Object> metadata
) {
    public static ValidationResult success() {
        return new ValidationResult(true, null, null, Map.of());
    }

    public static ValidationResult failure(String code, String message) {
        return new ValidationResult(false, code, message, Map.of());
    }
}
```

#### 4.2.4 Event Processor

Parses payloads and maps to internal events:

```java
public interface WebhookEventProcessor<T> {

    /**
     * Parse the raw webhook payload into a typed event.
     */
    T parsePayload(String rawPayload);

    /**
     * Map the provider-specific event to internal domain event.
     */
    InternalEvent mapToInternalEvent(T providerEvent);

    /**
     * Check if this event has already been processed (idempotency).
     */
    boolean isDuplicate(T event);

    /**
     * Mark event as processed.
     */
    void markProcessed(T event);
}
```

---

## 5. Bridger Webhook Implementation

### 5.1 Bridger Webhook Events

Bridger XG5 supports two webhook event types:

#### AlertStateClosed Event

Triggered when an alert is closed with a final decision:

```json
{
  "ResultId": 1234567,
  "EventType": "AlertClosed",
  "Status": "Transaction Approved",
  "DateCreated": "2026-01-13T10:30:00Z",
  "DateModified": "2026-01-13T14:45:30.123Z",
  "State": "Closed",
  "Note": 1,
  "AssignedTo": "ComplianceTeam",
  "AssignmentType": "Role",
  "DecisionTags": ["Reviewed", "FalsePositive"],
  "AddedToCSL": 0,
  "AddedToAcceptList": 1
}
```

#### AlertDecisionApplied Event

Triggered on any decision action, including file attachments:

```json
{
  "ResultId": 1234567,
  "EventType": "AlertDecisionApplied",
  "Status": "Undetermined",
  "DateCreated": "2026-01-13T10:30:00Z",
  "DateModified": "2026-01-13T14:45:30.123Z",
  "EFTId": "36ff0df7-1356-4c9a-8e8a-fbb3c5cbxxxx",
  "State": "Open",
  "AssignedTo": "John.Smith",
  "AssignmentType": "User",
  "Attachments": {
    "Event": "Add",
    "Files": [
      {"Id": 11118, "File": "supporting_doc.pdf"}
    ]
  }
}
```

### 5.2 Bridger Signature Validation

Bridger uses HMAC-SHA256 with a specific header format:

```
Headers:
  x-ms-date: Thu, 13 Jan 2026 14:45:30 GMT
  x-ms-content-sha256: cPYE02RM5qLuC1uIPPIhs8iZ0XA6U0QSUMPSsz2PnTQ=
  Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=IDw...
```

**Validation Algorithm:**

```java
@Component
public class BridgerSignatureValidator implements WebhookSignatureValidator {

    private final String hmacSecret;

    @Override
    public ValidationResult validate(WebhookRequest request) {
        try {
            // Step 1: Verify content hash
            String bodyHash = sha256Base64(request.getBody());
            String headerHash = request.getHeader("x-ms-content-sha256");

            if (!bodyHash.equals(headerHash)) {
                return ValidationResult.failure(
                    "CONTENT_HASH_MISMATCH",
                    "Payload hash does not match x-ms-content-sha256 header"
                );
            }

            // Step 2: Build string to sign
            String date = request.getHeader("x-ms-date");
            String host = request.getHost();
            String pathAndQuery = request.getPathAndQuery();

            String stringToSign = String.format(
                "POST\n%s\n%s;%s;%s",
                pathAndQuery,
                date,
                host,
                bodyHash
            );

            // Step 3: Calculate expected signature
            String expectedSignature = hmacSha256Base64(hmacSecret, stringToSign);

            // Step 4: Extract and compare signature from Authorization header
            String authHeader = request.getHeader("Authorization");
            String actualSignature = extractSignature(authHeader);

            if (!constantTimeEquals(expectedSignature, actualSignature)) {
                return ValidationResult.failure(
                    "SIGNATURE_MISMATCH",
                    "HMAC signature validation failed"
                );
            }

            // Step 5: Check timestamp freshness (prevent replay attacks)
            if (!isTimestampFresh(date, Duration.ofMinutes(5))) {
                return ValidationResult.failure(
                    "TIMESTAMP_EXPIRED",
                    "Request timestamp too old"
                );
            }

            return ValidationResult.success();

        } catch (Exception e) {
            return ValidationResult.failure(
                "VALIDATION_ERROR",
                "Error during signature validation: " + e.getMessage()
            );
        }
    }

    @Override
    public String getProviderName() {
        return "bridger";
    }
}
```

### 5.3 Bridger Event Handler

```java
@Component
public class BridgerWebhookHandler {

    private final BridgerSignatureValidator signatureValidator;
    private final BridgerEventProcessor eventProcessor;
    private final PaymentStateUpdater stateUpdater;
    private final WebhookAuditLogger auditLogger;

    public Mono<ServerResponse> handle(ServerRequest request) {
        return request.bodyToMono(String.class)
            .flatMap(body -> {
                WebhookRequest webhookRequest = WebhookRequest.from(request, body);

                // 1. Validate signature
                ValidationResult validation = signatureValidator.validate(webhookRequest);
                if (!validation.valid()) {
                    auditLogger.logValidationFailure(webhookRequest, validation);
                    return ServerResponse.status(401)
                        .bodyValue(Map.of("error", validation.errorCode()));
                }

                // 2. Parse event
                BridgerWebhookEvent event = eventProcessor.parsePayload(body);

                // 3. Check idempotency
                if (eventProcessor.isDuplicate(event)) {
                    auditLogger.logDuplicateEvent(event);
                    return ServerResponse.ok().build();  // ACK duplicate gracefully
                }

                // 4. Process event
                try {
                    processEvent(event);
                    eventProcessor.markProcessed(event);
                    auditLogger.logSuccess(event);
                    return ServerResponse.ok().build();

                } catch (Exception e) {
                    auditLogger.logProcessingError(event, e);
                    return ServerResponse.status(500)
                        .bodyValue(Map.of("error", "PROCESSING_ERROR"));
                }
            });
    }

    private void processEvent(BridgerWebhookEvent event) {
        switch (event.getEventType()) {
            case "AlertClosed" -> handleAlertClosed(event);
            case "AlertDecisionApplied" -> handleDecisionApplied(event);
            default -> log.warn("Unknown event type: {}", event.getEventType());
        }
    }

    private void handleAlertClosed(BridgerWebhookEvent event) {
        // Map Bridger status to Trax payment state
        String traxStatus = mapBridgerStatusToTrax(event.getStatus(), event.getState());

        // Find payment by Bridger ResultId (stored during screening)
        String paymentRef = lookupPaymentByResultId(event.getResultId());

        if (paymentRef != null) {
            stateUpdater.updatePaymentStatus(
                paymentRef,
                traxStatus,
                buildAuditDetails(event)
            );
        }
    }

    private String mapBridgerStatusToTrax(String bridgerStatus, String state) {
        if (!"Closed".equals(state)) {
            return null;  // Only process closed alerts
        }

        return switch (bridgerStatus) {
            case "Transaction Approved", "No Risk Detected", "False Positive"
                -> "EXTERNAL_ACCEPTED";
            case "Blocked Account", "Sanctions Match", "Transaction Denied"
                -> "EXTERNAL_REJECTED";
            case "Needs Review", "Undetermined"
                -> "EXTERNAL_SUSPECT";
            default -> {
                log.warn("Unmapped Bridger status: {}", bridgerStatus);
                yield "EXTERNAL_SUSPECT";
            }
        };
    }
}
```

### 5.4 Bridger Status Mapping

| Bridger Status | Bridger State | Trax Status | Payment Action |
|----------------|---------------|-------------|----------------|
| Transaction Approved | Closed | `EXTERNAL_ACCEPTED` | Release payment |
| No Risk Detected | Closed | `EXTERNAL_ACCEPTED` | Release payment |
| False Positive | Closed | `EXTERNAL_ACCEPTED` | Release payment |
| Blocked Account | Closed | `EXTERNAL_REJECTED` | Block payment |
| Sanctions Match | Closed | `EXTERNAL_REJECTED` | Block payment |
| Transaction Denied | Closed | `EXTERNAL_REJECTED` | Block payment |
| Needs Review | Open | `EXTERNAL_SUSPECT` | Continue holding |
| Undetermined | Closed | `EXTERNAL_SUSPECT` | Manual review |
| *(any)* | Open | *(no change)* | Alert still in progress |

---

## 6. Provider Plugin Framework

### 6.1 Plugin Interface

New webhook providers can be added by implementing the provider interface:

```java
public interface WebhookProviderPlugin {

    /**
     * Unique provider identifier (used in URL path).
     */
    String getProviderId();

    /**
     * Human-readable provider name.
     */
    String getProviderName();

    /**
     * Get the signature validator for this provider.
     */
    WebhookSignatureValidator getSignatureValidator();

    /**
     * Get the event processor for this provider.
     */
    WebhookEventProcessor<?> getEventProcessor();

    /**
     * Get the event handler for this provider.
     */
    WebhookEventHandler getEventHandler();

    /**
     * Provider-specific configuration schema.
     */
    ConfigurationSchema getConfigurationSchema();
}
```

### 6.2 Plugin Registration

Plugins are auto-discovered and registered at startup:

```java
@Configuration
public class WebhookPluginConfig {

    @Bean
    public WebhookPluginRegistry pluginRegistry(List<WebhookProviderPlugin> plugins) {
        WebhookPluginRegistry registry = new WebhookPluginRegistry();

        for (WebhookProviderPlugin plugin : plugins) {
            registry.register(plugin);
            log.info("Registered webhook provider: {} ({})",
                plugin.getProviderName(), plugin.getProviderId());
        }

        return registry;
    }
}
```

### 6.3 Example: Adding a New Provider

To add support for SWIFT gpi webhooks:

```java
@Component
public class SwiftGpiWebhookPlugin implements WebhookProviderPlugin {

    @Override
    public String getProviderId() {
        return "swift-gpi";
    }

    @Override
    public String getProviderName() {
        return "SWIFT gpi Tracker";
    }

    @Override
    public WebhookSignatureValidator getSignatureValidator() {
        return new SwiftGpiSignatureValidator(swiftGpiConfig);
    }

    @Override
    public WebhookEventProcessor<?> getEventProcessor() {
        return new SwiftGpiEventProcessor();
    }

    @Override
    public WebhookEventHandler getEventHandler() {
        return new SwiftGpiEventHandler(paymentTracker);
    }

    @Override
    public ConfigurationSchema getConfigurationSchema() {
        return ConfigurationSchema.builder()
            .requiredString("apiKey", "SWIFT gpi API Key")
            .requiredString("webhookSecret", "Webhook signing secret")
            .optionalBoolean("enableStatusUpdates", true)
            .build();
    }
}
```

---

## 7. Security

### 7.1 Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEBHOOK SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Network Security                                                   │
│  ─────────────────────────                                                   │
│  • TLS 1.2+ required (TLS 1.3 preferred)                                    │
│  • IP allowlist per provider                                                │
│  • DDoS protection at load balancer                                         │
│  • Rate limiting per source IP                                              │
│                                                                              │
│  Layer 2: Request Validation                                                 │
│  ───────────────────────────                                                 │
│  • Provider-specific signature validation                                   │
│  • Content hash verification                                                │
│  • Timestamp freshness check (anti-replay)                                  │
│  • Request size limits                                                       │
│                                                                              │
│  Layer 3: Payload Security                                                   │
│  ─────────────────────────                                                   │
│  • JSON schema validation                                                   │
│  • Input sanitization                                                       │
│  • Sensitive field detection (PII handling)                                 │
│                                                                              │
│  Layer 4: Processing Security                                                │
│  ───────────────────────────                                                 │
│  • Idempotency enforcement                                                  │
│  • Transaction isolation                                                    │
│  • Error message sanitization (no internal details)                         │
│                                                                              │
│  Layer 5: Audit & Monitoring                                                 │
│  ────────────────────────────                                                │
│  • All requests logged (success and failure)                                │
│  • Signature failures alerted                                               │
│  • Anomaly detection (unusual patterns)                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Signature Validation Strategies

| Provider Type | Validation Method | Implementation |
|---------------|-------------------|----------------|
| **HMAC-based** (Bridger, Stripe) | Shared secret + HMAC-SHA256 | `HmacSignatureValidator` |
| **JWT-based** (Auth0, Okta) | RSA/ECDSA signature verification | `JwtSignatureValidator` |
| **X.509-based** (Banks) | Certificate chain validation | `X509SignatureValidator` |
| **API Key** (Simple providers) | Header API key + IP allowlist | `ApiKeyValidator` |
| **Custom** (Legacy systems) | Provider-specific implementation | Custom validator class |

### 7.3 Replay Attack Prevention

```java
@Component
public class ReplayProtectionService {

    private final Cache<String, Instant> processedRequests;

    /**
     * Check if request is a replay and record if not.
     *
     * @param requestId Unique request identifier (signature hash or event ID)
     * @param timestamp Request timestamp
     * @return true if this is a replay (duplicate), false if new
     */
    public boolean isReplay(String requestId, Instant timestamp) {
        // Reject if timestamp too old
        if (timestamp.isBefore(Instant.now().minus(REPLAY_WINDOW))) {
            return true;
        }

        // Check if already processed
        Instant previous = processedRequests.getIfPresent(requestId);
        if (previous != null) {
            return true;  // Duplicate
        }

        // Record this request
        processedRequests.put(requestId, timestamp);
        return false;
    }
}
```

### 7.4 Secret Management

```yaml
webhooks:
  secrets:
    # Store in environment variables (container deployments)
    bridger:
      hmacSecret: ${BRIDGER_WEBHOOK_SECRET}

    # Or reference vault path (enterprise deployments)
    swiftGpi:
      secretRef: vault://secrets/webhooks/swift-gpi/signing-key

  secretRotation:
    enabled: true
    gracePeriod: 24h  # Accept old + new secret during rotation
    notificationEmail: security-team@company.com
```

---

## 8. Idempotency

### 8.1 Idempotency Design

Webhooks may be delivered multiple times. The system must handle duplicates gracefully:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IDEMPOTENCY FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Webhook Received                                                            │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────┐                                                        │
│  │ Generate        │   eventId = hash(providerId + resultId + timestamp)    │
│  │ Idempotency Key │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────────┐        │
│  │ Check           │───►│ Idempotency Store                       │        │
│  │ Duplicate       │    │ (Redis/Database)                        │        │
│  └────────┬────────┘    │                                         │        │
│           │             │ Key: "webhook:bridger:12345:2026-01-13" │        │
│           │             │ Value: {processed: true, result: "ok"}  │        │
│           │             └─────────────────────────────────────────┘        │
│           │                                                                  │
│     ┌─────┴─────┐                                                           │
│     │           │                                                           │
│   Found      Not Found                                                       │
│     │           │                                                           │
│     ▼           ▼                                                           │
│  Return     Process Event                                                    │
│  HTTP 200   Store Result                                                     │
│  (cached    Return HTTP 200                                                  │
│   result)                                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Idempotency Store

```java
@Component
public class WebhookIdempotencyStore {

    private final RedisTemplate<String, IdempotencyRecord> redis;
    private final Duration ttl = Duration.ofHours(24);

    public Optional<IdempotencyRecord> get(String idempotencyKey) {
        return Optional.ofNullable(redis.opsForValue().get(idempotencyKey));
    }

    public void store(String idempotencyKey, IdempotencyRecord record) {
        redis.opsForValue().set(idempotencyKey, record, ttl);
    }

    public String generateKey(String provider, String eventId, Instant timestamp) {
        String dateStr = timestamp.truncatedTo(ChronoUnit.DAYS).toString();
        return String.format("webhook:%s:%s:%s", provider, eventId, dateStr);
    }
}

public record IdempotencyRecord(
    Instant processedAt,
    String result,
    int httpStatus,
    Map<String, Object> metadata
) {}
```

---

## 9. Error Handling

### 9.1 Error Response Strategy

| Scenario | HTTP Response | Provider Behavior |
|----------|---------------|-------------------|
| Signature validation failed | `401 Unauthorized` | Alert security team, may retry |
| Malformed payload | `400 Bad Request` | Provider should fix and resend |
| Idempotent duplicate | `200 OK` | Treat as success (no retry) |
| Processing error (transient) | `503 Service Unavailable` | Provider should retry |
| Processing error (permanent) | `200 OK` + error logged | Ack receipt, handle internally |
| Rate limited | `429 Too Many Requests` | Provider should backoff |

### 9.2 Graceful Degradation

```yaml
errorHandling:
  # When webhook processing fails, don't lose the event
  failureQueue:
    enabled: true
    queueName: webhook-failures
    retryPolicy:
      maxRetries: 5
      backoffMultiplier: 2
      initialDelay: 60000  # 1 minute
      maxDelay: 3600000    # 1 hour

  # Alert on persistent failures
  alerting:
    consecutiveFailures: 3
    channels:
      - ops-slack
      - pagerduty
```

### 9.3 Dead Letter Queue

Events that cannot be processed after retries are stored for manual review:

```java
@Component
public class WebhookDeadLetterHandler {

    private final DeadLetterQueue dlq;
    private final AlertService alertService;

    public void handlePermanentFailure(WebhookEvent event, Exception error) {
        DeadLetterEntry entry = DeadLetterEntry.builder()
            .provider(event.getProvider())
            .eventId(event.getEventId())
            .payload(event.getRawPayload())
            .error(error.getMessage())
            .timestamp(Instant.now())
            .retryCount(event.getRetryCount())
            .build();

        dlq.store(entry);

        alertService.sendAlert(
            Alert.warning("Webhook moved to dead letter queue")
                .withProvider(event.getProvider())
                .withEventId(event.getEventId())
                .withError(error.getMessage())
        );
    }
}
```

---

## 10. Configuration

### 10.1 Global Webhook Configuration

```yaml
# webhook-config.yml
webhooks:
  enabled: true

  server:
    basePath: /api/webhooks
    port: 8443
    tls:
      enabled: true
      minVersion: TLSv1.2
      certFile: ${WEBHOOK_TLS_CERT}
      keyFile: ${WEBHOOK_TLS_KEY}

  security:
    ipAllowlistEnabled: true
    rateLimiting:
      enabled: true
      globalLimit: 100  # requests/second
    replayProtection:
      enabled: true
      windowMinutes: 5

  processing:
    asyncEnabled: true
    threadPoolSize: 10
    queueCapacity: 1000

  idempotency:
    enabled: true
    store: redis
    ttlHours: 24

  monitoring:
    metricsEnabled: true
    accessLogEnabled: true
    sensitiveFieldMasking: true
```

### 10.2 Provider-Specific Configuration

```yaml
# bridger-webhook-config.yml
webhooks:
  providers:
    bridger:
      enabled: true
      path: /api/webhooks/bridger

      security:
        signatureType: HMAC_SHA256
        hmacSecret: ${BRIDGER_WEBHOOK_SECRET}
        ipAllowlist:
          - 52.xxx.xxx.0/24
          - 52.xxx.xxx.0/24

      eventHandling:
        supportedEvents:
          - AlertClosed
          - AlertDecisionApplied
        statusMapping:
          "Transaction Approved": EXTERNAL_ACCEPTED
          "No Risk Detected": EXTERNAL_ACCEPTED
          "False Positive": EXTERNAL_ACCEPTED
          "Blocked Account": EXTERNAL_REJECTED
          "Sanctions Match": EXTERNAL_REJECTED
          "Transaction Denied": EXTERNAL_REJECTED
          "*": EXTERNAL_SUSPECT  # Default

      traxIntegration:
        updatePaymentStatus: true
        createAuditLog: true
        notifyCompliance: true
```

---

## 11. Monitoring and Observability

### 11.1 Metrics

```yaml
metrics:
  prefix: bankconnector.webhooks

  counters:
    - name: received_total
      labels: [provider, event_type]
      description: Total webhooks received

    - name: validation_failures_total
      labels: [provider, failure_reason]
      description: Signature validation failures

    - name: processing_errors_total
      labels: [provider, error_type]
      description: Processing errors by type

    - name: duplicates_total
      labels: [provider]
      description: Duplicate webhooks detected

  histograms:
    - name: processing_duration_seconds
      labels: [provider, event_type]
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
      description: Webhook processing time

  gauges:
    - name: queue_depth
      labels: [provider]
      description: Pending webhooks in queue
```

### 11.2 Dashboards

Key dashboard panels:

| Panel | Visualization | Query |
|-------|--------------|-------|
| Webhook Volume | Time series | `sum(rate(webhooks_received_total[5m])) by (provider)` |
| Error Rate | Percentage | `sum(rate(validation_failures_total[5m])) / sum(rate(webhooks_received_total[5m]))` |
| P95 Latency | Heatmap | `histogram_quantile(0.95, webhooks_processing_duration_seconds)` |
| Status Breakdown | Pie chart | `sum(webhooks_received_total) by (event_type)` |

### 11.3 Alerting Rules

```yaml
alerts:
  - name: WebhookValidationFailureSpike
    condition: |
      sum(rate(webhooks_validation_failures_total[5m])) > 10
    severity: warning
    message: "High rate of webhook signature validation failures"
    runbook: "Check IP allowlist, verify secrets not rotated"

  - name: WebhookProcessingLatencyHigh
    condition: |
      histogram_quantile(0.95, webhooks_processing_duration_seconds) > 5
    severity: warning
    message: "Webhook processing latency exceeding SLA"
    runbook: "Check database connections, Trax API availability"

  - name: WebhookQueueBacklog
    condition: |
      webhooks_queue_depth > 100
    severity: critical
    message: "Webhook processing queue building up"
    runbook: "Scale processors, check for blocked downstream services"

  - name: BridgerWebhooksMissing
    condition: |
      absent(webhooks_received_total{provider="bridger"}[1h])
    severity: warning
    message: "No Bridger webhooks received in 1 hour"
    runbook: "Verify Bridger webhook configuration, check network connectivity"
```

### 11.4 Logging

```yaml
logging:
  webhooks:
    level: INFO
    format: json

    # Log structure for each webhook
    fields:
      always:
        - timestamp
        - provider
        - eventType
        - processingTimeMs
        - result
      onError:
        - errorCode
        - errorMessage
        - stackTrace (DEBUG only)

    # Never log these (PII protection)
    redact:
      - payload.name
      - payload.address
      - payload.dateOfBirth
      - headers.Authorization
```

Example log output:

```json
{
  "timestamp": "2026-01-13T14:45:30.123Z",
  "level": "INFO",
  "logger": "webhooks.bridger",
  "message": "Webhook processed successfully",
  "provider": "bridger",
  "eventType": "AlertDecisionApplied",
  "eventId": "12345678",
  "processingTimeMs": 45,
  "result": "PAYMENT_STATUS_UPDATED",
  "paymentRef": "PAY-2026-001234",
  "traceId": "abc123def456"
}
```

---

## 12. Testing Strategy

### 12.1 Test Categories

| Category | Purpose | Tools |
|----------|---------|-------|
| Unit Tests | Validator logic, event mapping | JUnit, Mockito |
| Integration Tests | Full webhook flow with mocked providers | Testcontainers, WireMock |
| Contract Tests | Verify compliance with provider specs | Pact, Spring Cloud Contract |
| Load Tests | Throughput and latency validation | Gatling, k6 |
| Security Tests | Signature bypass attempts | OWASP ZAP, custom scripts |

### 12.2 Test Webhook Generator

A utility to generate test webhooks for development and testing:

```java
@RestController
@Profile("dev")
@RequestMapping("/test/webhooks")
public class TestWebhookGenerator {

    @PostMapping("/bridger/send")
    public ResponseEntity<?> sendTestBridgerWebhook(
            @RequestParam String targetUrl,
            @RequestBody BridgerTestPayload payload) {

        // Generate valid HMAC signature
        String signature = generateBridgerSignature(payload);

        // Send to target URL
        webClient.post()
            .uri(targetUrl)
            .header("x-ms-date", formatDate(Instant.now()))
            .header("x-ms-content-sha256", hashPayload(payload))
            .header("Authorization", signature)
            .bodyValue(payload)
            .retrieve()
            .toBodilessEntity()
            .block();

        return ResponseEntity.ok().build();
    }
}
```

### 12.3 Webhook Replay Tool

For troubleshooting, replay webhooks from audit log:

```bash
# Replay a specific webhook from audit log
./webhook-replay.sh \
  --provider bridger \
  --event-id 12345678 \
  --target http://localhost:8080/api/webhooks/bridger
```

---

## 13. Deployment

### 13.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK DEPLOYMENT TOPOLOGY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Internet                                                                    │
│      │                                                                       │
│      │  HTTPS (TLS 1.2+)                                                    │
│      ▼                                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          Load Balancer                                 │  │
│  │  • SSL termination                                                    │  │
│  │  • IP allowlist                                                       │  │
│  │  • DDoS protection                                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      │  Health checks: /health                                              │
│      ▼                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Bank Connector  │  │ Bank Connector  │  │ Bank Connector  │             │
│  │ Instance 1      │  │ Instance 2      │  │ Instance N      │             │
│  │                 │  │                 │  │                 │             │
│  │ Webhook Module  │  │ Webhook Module  │  │ Webhook Module  │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                                ▼                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Shared Infrastructure                             │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │      Redis      │  │    Database     │  │      Trax       │       │  │
│  │  │  (Idempotency)  │  │  (Audit Logs)   │  │  (Payment Hub)  │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Infrastructure Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| Load Balancer | Layer 7 (HTTP-aware) | For path-based routing |
| Instances | Min 2 for HA | Auto-scale on queue depth |
| Redis | Cluster mode | For distributed idempotency |
| TLS Certificates | Valid CA-signed | Providers may reject self-signed |
| Public IP | Static | For provider IP whitelisting |
| DNS | Low TTL | For quick failover |

### 13.3 Rollout Plan

#### Phase 1: Infrastructure Setup

- Deploy webhook endpoints in shadow mode (receive, validate, log only)
- Configure provider IP allowlists
- Verify TLS certificates accepted by providers
- Set up monitoring dashboards and alerts

#### Phase 2: Bridger Integration

- Enable Bridger webhook processing
- Configure status mapping
- Test with synthetic events
- Enable production traffic

#### Phase 3: Additional Providers

- Add SWIFT gpi webhooks (if contracted)
- Add other compliance provider webhooks
- Expand to bank-specific webhooks

---

## 14. Trax Integration Details

### 14.1 Payment State Updates

When a webhook indicates a decision on a screened payment:

```java
@Component
public class TraxPaymentStateUpdater {

    private final TraxApiClient traxApi;
    private final AuditLogger auditLogger;

    public void updatePaymentStatus(
            String paymentReference,
            String newStatus,
            WebhookDecisionDetails details) {

        // Build state transition request
        TraxStateTransition transition = TraxStateTransition.builder()
            .paymentReference(paymentReference)
            .targetStatus(newStatus)
            .source("WEBHOOK")
            .sourceProvider(details.getProvider())
            .sourceEventId(details.getEventId())
            .timestamp(details.getTimestamp())
            .decisionBy(details.getDecisionBy())
            .decisionReason(details.getDecisionReason())
            .build();

        // Execute transition via Trax API
        traxApi.executeStateTransition(transition);

        // Log for audit trail
        auditLogger.logStateTransition(transition);
    }
}
```

### 14.2 Correlation Strategy

Webhooks must be correlated to original payments. Bridger uses `ResultId`:

```
Screening Request:                    Webhook Callback:
─────────────────                    ──────────────────
Payment: PAY-2026-001234             ResultId: 12345678
   │                                       │
   └── Screen via Bridger API             │
           │                               │
           └── ResultId: 12345678         │
                   │                       │
                   └── Store mapping ──────┘
                       in database

Lookup: bridger_result_mapping
┌───────────────────┬─────────────┬────────────────────┐
│ payment_reference │ result_id   │ created_at         │
├───────────────────┼─────────────┼────────────────────┤
│ PAY-2026-001234   │ 12345678    │ 2026-01-13 10:30   │
└───────────────────┴─────────────┴────────────────────┘
```

---

## 15. Future Considerations

### 15.1 Event Bus Integration

When Trax adopts event-driven architecture (per monolith decomposition roadmap):

```yaml
futureState:
  eventBus:
    enabled: true
    type: kafka
    topics:
      webhookReceived: webhooks.received
      paymentStatusChanged: payments.status.changed

    # Webhooks become events in the platform
    flow:
      1. Webhook received
      2. Validated and parsed
      3. Published to Kafka topic
      4. Multiple consumers react:
         - Payment service updates status
         - Audit service logs decision
         - Notification service alerts users
         - Analytics service records metrics
```

### 15.2 Multi-Provider Routing

Support multiple screening providers with intelligent routing:

```yaml
multiProvider:
  routing:
    rules:
      - condition: payment.amount > 1000000
        providers: [bridger, dowJones]  # Screen with both
      - condition: payment.corridor == "IRAN_ADJACENT"
        providers: [bridger]             # Specialized screening
      - default:
        providers: [bridger]             # Standard screening

    aggregation:
      strategy: mostRestrictive  # If any provider flags, flag overall
```

### 15.3 Webhook Gateway Service

Eventually extract webhooks into a dedicated microservice:

```
┌────────────────────────────────────────────────────────────────┐
│               FUTURE: WEBHOOK GATEWAY MICROSERVICE              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Webhook Gateway Service                     │   │
│  │                                                          │   │
│  │  • Receives webhooks from ALL external providers        │   │
│  │  • Validates signatures                                  │   │
│  │  • Transforms to canonical event format                 │   │
│  │  • Publishes to event bus                               │   │
│  │  • Scales independently                                 │   │
│  │                                                          │   │
│  │  Consumers:                                              │   │
│  │  - Bank Connector (payment status updates)              │   │
│  │  - Compliance Service (audit logging)                   │   │
│  │  - Analytics Service (metrics)                          │   │
│  │  - Notification Service (alerts)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 16. Appendices

### A. Bridger Webhook Headers Reference

| Header | Description | Example |
|--------|-------------|---------|
| `x-ms-date` | UTC timestamp | `Thu, 13 Jan 2026 14:45:30 GMT` |
| `x-ms-content-sha256` | Base64 SHA256 of body | `cPYE02RM5qLu...` |
| `Authorization` | HMAC-SHA256 signature | `HMAC-SHA256 SignedHeaders=...&Signature=...` |
| `Content-Type` | Always JSON | `application/json` |

### B. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SIGNATURE_INVALID` | 401 | HMAC signature verification failed |
| `TIMESTAMP_EXPIRED` | 401 | Request timestamp too old |
| `CONTENT_HASH_MISMATCH` | 401 | Body hash doesn't match header |
| `PROVIDER_UNKNOWN` | 400 | Unrecognized provider in URL |
| `PAYLOAD_MALFORMED` | 400 | Cannot parse JSON payload |
| `EVENT_TYPE_UNKNOWN` | 400 | Unrecognized event type |
| `RATE_LIMITED` | 429 | Too many requests |
| `PROCESSING_ERROR` | 500 | Internal processing failure |

### C. Sample Webhook Test Payloads

**Bridger AlertClosed - Approved:**
```json
{
  "ResultId": 12345678,
  "EventType": "AlertClosed",
  "Status": "Transaction Approved",
  "DateCreated": "2026-01-13T10:30:00Z",
  "DateModified": "2026-01-13T14:45:30.123Z",
  "State": "Closed",
  "AssignedTo": "ComplianceTeam",
  "AssignmentType": "Role",
  "DecisionTags": ["Reviewed", "FalsePositive"],
  "AddedToAcceptList": 1
}
```

**Bridger AlertClosed - Rejected:**
```json
{
  "ResultId": 12345679,
  "EventType": "AlertClosed",
  "Status": "Blocked Account",
  "DateCreated": "2026-01-13T11:00:00Z",
  "DateModified": "2026-01-13T15:30:00.456Z",
  "State": "Closed",
  "AssignedTo": "SeniorCompliance",
  "AssignmentType": "User",
  "DecisionTags": ["SanctionsMatch", "OFAC"],
  "AddedToCSL": 1
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-13 | Claude | Initial design document |
| 1.1 | 2026-01-16 | Claude | Added comprehensive Column Banking Platform webhook use case (Section 3.3) |
