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
│    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│    │ Bridger  │    │  SWIFT   │    │ Dow Jones│    │  Banks   │            │
│    │   XG5    │    │   gpi    │    │   Risk   │    │          │            │
│    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘            │
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
            SwiftGpiWebhookHandler swiftHandler,
            GenericWebhookHandler genericHandler) {

        return RouterFunctions
            .route(POST("/api/webhooks/bridger"), bridgerHandler::handle)
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
