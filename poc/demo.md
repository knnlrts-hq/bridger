# Bridger XG5 Integration POC — End-to-End Demo

*2026-02-16T08:40:21Z by Showboat 0.5.0*

This document walks through the end-to-end flow of the Bridger XG5 Integration POC — from ingesting a pain.001.001.03 payment file, through Trax layer transformation, Bridger API screening, threshold-based decisioning, to generating a pain.002.001.03 status report. All API interactions are mocked in-browser; no external services are required.

## POC Structure

The POC consists of 5 interactive HTML tools plus shared modules, all served as static files via GitHub Pages.

```bash
ls -1 poc/*.html poc/*.js
```

```output
poc/01-pain001-parser.html
poc/02-api-explorer.html
poc/03-screening-flow.html
poc/04-webhook-simulator.html
poc/05-compliance-dashboard.html
poc/index.html
poc/mock-bridger-server.js
poc/sample-data.js
```

| # | Tool | File | Purpose |
|---|------|------|---------|
| 1 | pain.001 Parser | 01-pain001-parser.html | Parse and visualize ISO 20022 pain.001.001.03 XML, extract screenable parties |
| 2 | API Explorer | 02-api-explorer.html | Manually construct and execute Bridger API calls (Token, Search, Results) |
| 3 | Screening Flow | 03-screening-flow.html | E2E pipeline: Trax parses pain.001, screens via Bridger, builds pain.002 |
| 4 | Webhook Simulator | 04-webhook-simulator.html | HMAC-SHA256 webhook signing and verification demo |
| 5 | Compliance Dashboard | 05-compliance-dashboard.html | Review SUSPECT alerts, make accept/reject/escalate decisions |
| - | Mock Bridger Server | mock-bridger-server.js | In-memory Bridger XG5 API simulation (Token, Lists, Results, Webhooks) |
| - | Sample Data | sample-data.js | pain.001 XML samples, parser, entity mapper, pain.002 generator |

## Step 1 — Trax Layer: Parse pain.001.001.03 and Transform to Bridger Format

The Trax payment hub receives ISO 20022 pain.001.001.03 (Customer Credit Transfer Initiation) XML from the originating ERP. The Trax layer is responsible for:
- Parsing the XML structure (GrpHdr, PmtInf, CdtTrfTxInf)
- Extracting all screenable parties (Debtor, Creditor, Ultimate parties)
- Transforming each party into a Bridger EntitySearchRequest record

This is demonstrated in Tool 1 (Parser) and the first pipeline step in Tool 3 (Screening Flow).

```bash
head -25 poc/sample-data.js | tail -16
```

```output
  const SIMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG-2026-0213-001</MsgId>
      <CreDtTm>2026-02-13T09:00:00</CreDtTm>
      <NbOfTxs>3</NbOfTxs>
      <CtrlSum>125000.00</CtrlSum>
      <InitgPty>
        <Nm>Acme Corporation</Nm>
        <Id><OrgId><BICOrBEI>ACMEUS33XXX</BICOrBEI></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-BATCH-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
```

The Trax layer parses the XML and maps ISO 20022 fields to Bridger entity fields:

| ISO 20022 Field | Bridger Entity Field | Party Type |
|-----------------|---------------------|------------|
| Dbtr/Nm | Entity.Name.Full | Debtor |
| Dbtr/PstlAdr/* | Entity.Addresses[0].* | Debtor |
| Cdtr/Nm | Entity.Name.Full | Creditor |
| Cdtr/PstlAdr/* | Entity.Addresses[0].* | Creditor |
| CdtrAcct/IBAN | Entity.IDs[].Number (type: IBAN) | Creditor |
| UltmtCdtr/Nm | Entity.Name.Full | Ultimate Creditor |

## Step 2 — Bridger API Authentication

Before screening, the integration authenticates with Bridger XG5 via the Token/Issue endpoint. This returns a JWT that is cached and used for all subsequent API calls.

```bash
grep -A 12 'function tokenIssue' poc/mock-bridger-server.js | head -13
```

```output
  function tokenIssue(clientId, userId, password) {
    if (!clientId || !userId || !password) {
      return { error: { Code: 401, Message: 'Missing credentials' } };
    }
    const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.' + btoa(JSON.stringify({
      sub: `${clientId}/${userId}`,
      iss: 'MockBridgerXG5',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      client_id: clientId
    })) + '.mock-signature-' + Date.now();
    const entry = { token, expiresAt: Date.now() + 3600000 };
    tokens.set(token, entry);
```

## Step 3 — Bridger API: Lists/Search (Sanctions Screening)

Transformed entities are submitted to the Bridger Lists/Search endpoint. The mock server uses bigram-based fuzzy matching against a built-in watchlist of ~18 entities across OFAC SDN, EU Consolidated Sanctions, UN Consolidated List, and PEP databases.

```bash
grep 'listName:' poc/mock-bridger-server.js | sed "s/.*listName: '\(.*\)', listId.*/\1/" | sort | uniq -c | sort -rn
```

```output
      8 OFAC SDN
      5 EU Consolidated Sanctions
      3 UN Consolidated List
      2 PEP Database
```

The search returns match results with scores (0-100) for each entity. The fuzzy matching algorithm uses bigram similarity:
1. Normalize strings (lowercase, strip non-alphanumeric)
2. Extract character bigrams
3. Jaccard similarity: 2 * intersection / union
4. Score threshold: matches with score >= 25 are returned

## Step 4 — Threshold-Based Decisioning

The Trax layer applies configurable threshold rules to screening results:

| Score Range | Decision | Trax Status | ISO 20022 Code |
|-------------|----------|-------------|----------------|
| 0 – 29 | Auto-Release | EXTERNAL_ACCEPTED | ACCP (Accepted) |
| 30 – 89 | Hold for Review | EXTERNAL_SUSPECT | PDNG (Pending) |
| 90 – 100 | Auto-Block | EXTERNAL_REJECTED | RJCT (Rejected) |

These thresholds are configurable in the Screening Flow tool (Tool 3).

```bash
grep -A 18 'function applyThresholds' poc/mock-bridger-server.js
```

```output
  function applyThresholds(searchResults, thresholds = {}) {
    const autoAccept = thresholds.autoAccept ?? 30;
    const autoReject = thresholds.autoReject ?? 90;

    return searchResults.SearchResults.Records.map(rec => {
      const topScore = rec._meta?.topScore || 0;
      let traxStatus, traxCode, decision;

      if (!rec.HasScreeningListMatches || topScore < autoAccept) {
        traxStatus = 'EXTERNAL_ACCEPTED';
        traxCode = 'PAY_PMT_REL_EXTERNAL_ACCEPTED';
        decision = 'Auto-Release';
      } else if (topScore >= autoReject) {
        traxStatus = 'EXTERNAL_REJECTED';
        traxCode = 'PAY_PMT_REL_EXTERNAL_REJECTED';
        decision = 'Auto-Block';
      } else {
        traxStatus = 'EXTERNAL_SUSPECT';
        traxCode = 'PAY_PMT_REL_EXTERNAL_SUSPECT';
```

## Step 5 — Trax Layer: Build pain.002.001.03 (Payment Status Report)

After screening and threshold decisions, the Trax layer transforms the results back into ISO 20022 pain.002.001.03 format. This is the Payment Status Report sent back to the originating ERP/payment factory.

The transformation maps:
- Trax EXTERNAL_ACCEPTED → pain.002 TxSts: ACCP (AcceptedCustomerProfile)
- Trax EXTERNAL_REJECTED → pain.002 TxSts: RJCT with reason NAUT (NotAuthorised – Sanctions match)
- Trax EXTERNAL_SUSPECT → pain.002 TxSts: PDNG with reason COMP (Compliance review required)

The pain.002 includes the original message ID, transaction count, and per-transaction status entries.

```bash
grep -A 6 'function toIso20022Status' poc/sample-data.js
```

```output
    function toIso20022Status(traxStatus) {
      switch (traxStatus) {
        case 'EXTERNAL_ACCEPTED': return { code: 'ACCP', reason: '', description: 'AcceptedCustomerProfile' };
        case 'EXTERNAL_REJECTED': return { code: 'RJCT', reason: 'NAUT', description: 'NotAuthorised – Sanctions match' };
        case 'EXTERNAL_SUSPECT':  return { code: 'PDNG', reason: 'COMP', description: 'Pending – Compliance review required' };
        default:                  return { code: 'PDNG', reason: 'NARR', description: 'Pending' };
      }
```

## Step 6 — Webhook-Driven Compliance Review

For payments in SUSPECT status (PDNG), the compliance officer reviews alerts in the Compliance Dashboard (Tool 5). When a decision is made in the Bridger XG5 interface, a webhook is sent back to the Bank Connector:

- **AlertStateClosed**: Alert has been closed with a final decision
- **AlertDecisionApplied**: A specific decision action was taken

Webhooks are signed using HMAC-SHA256 with three headers:
- x-ms-date: UTC timestamp
- x-ms-content-sha256: Base64 SHA256 hash of payload
- Authorization: HMAC-SHA256 signature

The Bank Connector validates the signature before applying the decision to update the Trax payment status.

## End-to-End Architecture

The complete flow through the integrated system:

```bash
grep -A 17 'Architecture' poc/index.html | grep -v '<h3>Architecture' | grep -v '<pre>' | grep -v '</pre>' | sed 's/^    //'
```

```output
ERP / Payment Factory       Trax Layer (Payment Hub)        Bridger XG5 (Mocked)
   |                            |                            |
  pain.001.001.03 ──────────► Parse pain.001              Token/Issue
   |                      Transform to            ──────► Lists/Search
   |                      Bridger entity format   ◄────── SearchResults
   |                            |                            |
   |                     Apply Thresholds                    |
   |                     (auto-accept / suspect / reject)    |
   |                            |                            |
   |                     Transform results to          Webhook Events
   |                      pain.002.001.03            ──► AlertStateClosed
   |                      (Payment Status Report)    ──► AlertDecisionApplied
   |                            |                            |
  pain.002.001.03 ◄──────── ACCP / RJCT / PDNG    Compliance Review
  (Status Report)                   |               ◄── HMAC-SHA256 Signed
   |                     Compliance Dashboard                |
```

## Key Design Decisions

1. **Trax layer owns all format transformations**: pain.001.001.03 parsing and pain.002.001.03 generation happen entirely within the Trax layer. The Bridger API only sees normalized entity records.

2. **Provider-agnostic architecture**: The Bank Connector webhook framework supports pluggable providers (Bridger, Dow Jones, Refinitiv, Column, etc.) — each provider implements its own signature validator and event processor.

3. **Threshold-based automation**: Auto-accept and auto-reject thresholds reduce manual review burden. Only borderline cases (SUSPECT) require human intervention.

4. **Stateless screening**: Each screening run is independent. The mock server simulates stateful record management (Results/SetRecordState) for the compliance review workflow.

5. **No backend required**: The entire POC runs as static files in the browser, making it portable and easy to demo. The mock Bridger server provides realistic API responses using in-memory state.

## Running the POC

The POC is deployed via GitHub Pages. All tools are accessible from the landing page (index.html). No build step or backend is required — open any HTML file directly in a browser.

```bash
wc -l poc/*.html poc/*.js | tail -1
```

```output
  7484 total
```
