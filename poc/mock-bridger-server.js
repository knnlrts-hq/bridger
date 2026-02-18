/**
 * Mock Bridger XG5 REST API Server
 *
 * In-memory simulation of LexisNexis Bridger Insight XG5 Web Services.
 * Provides: Token/Issue, Lists/Search, Results/*, webhook signing/verification.
 */
const MockBridger = (() => {
  // --- State ---
  let nextRunId = 100001;
  let nextResultId = 200001;
  const tokens = new Map();
  const runs = new Map();
  const records = new Map();
  const webhookLog = [];

  // --- Built-in Watchlist ---
  const WATCHLIST = [
    { id: 'OFAC-001', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Ahmad Trading Corporation', entityType: 'Business', reasonListed: 'Sanctions Program: IRAN', dateListed: '2023-03-15', country: 'IR', aliases: ['Ahmad Trade Corp', 'ATC Holdings'] },
    { id: 'OFAC-002', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Mikhail Petrov', entityType: 'Individual', reasonListed: 'Sanctions Program: RUSSIA', dateListed: '2022-06-01', country: 'RU', aliases: ['M. Petrov', 'Mikhail V. Petrov'] },
    { id: 'OFAC-003', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Petrov Holdings Ltd', entityType: 'Business', reasonListed: 'Sanctions Program: RUSSIA', dateListed: '2022-06-01', country: 'RU', aliases: ['Petrov Holdings'] },
    { id: 'OFAC-004', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Hassan Al-Rahman', entityType: 'Individual', reasonListed: 'Sanctions Program: SDGT', dateListed: '2021-11-20', country: 'SY', aliases: ['H. Al-Rahman', 'Hassan Rahman'] },
    { id: 'OFAC-005', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Desert Logistics LLC', entityType: 'Business', reasonListed: 'Sanctions Program: SYRIA', dateListed: '2023-01-10', country: 'SY', aliases: ['Desert Logistics'] },
    { id: 'EU-001', listName: 'EU Consolidated Sanctions', listId: 'EU-CONSOL-2024', entityName: 'EuroTrade Sanctions GmbH', entityType: 'Business', reasonListed: 'EU Council Decision 2022/xxx', dateListed: '2022-04-08', country: 'BY', aliases: ['EuroTrade GmbH', 'EuroTrade Sanctions'] },
    { id: 'EU-002', listName: 'EU Consolidated Sanctions', listId: 'EU-CONSOL-2024', entityName: 'Volkov Industries JSC', entityType: 'Business', reasonListed: 'EU Council Regulation 833/2014', dateListed: '2022-03-01', country: 'RU', aliases: ['Volkov Industries', 'Volkov Ind.'] },
    { id: 'EU-003', listName: 'EU Consolidated Sanctions', listId: 'EU-CONSOL-2024', entityName: 'Viktor Volkov', entityType: 'Individual', reasonListed: 'EU Council Regulation 833/2014', dateListed: '2022-03-01', country: 'RU', aliases: ['V. Volkov', 'Viktor A. Volkov'] },
    { id: 'UN-001', listName: 'UN Consolidated List', listId: 'UN-CONSOL-2024', entityName: 'Global Arms Trading Ltd', entityType: 'Business', reasonListed: 'UN Security Council Resolution 1718', dateListed: '2020-08-15', country: 'KP', aliases: ['Global Arms Ltd', 'Global Arms Trading'] },
    { id: 'UN-002', listName: 'UN Consolidated List', listId: 'UN-CONSOL-2024', entityName: 'Al-Noor Foundation', entityType: 'Business', reasonListed: 'UN Security Council Resolution 1267', dateListed: '2019-05-22', country: 'AF', aliases: ['Al Noor Foundation', 'Alnoor Foundation'] },
    { id: 'PEP-001', listName: 'PEP Database', listId: 'WC-PEP-2024', entityName: 'Carlos Mendez-Silva', entityType: 'Individual', reasonListed: 'Politically Exposed Person - Former Minister of Finance', dateListed: '2024-01-15', country: 'VE', aliases: ['Carlos Mendez', 'C. Mendez-Silva'] },
    { id: 'PEP-002', listName: 'PEP Database', listId: 'WC-PEP-2024', entityName: 'Natalia Sokolova', entityType: 'Individual', reasonListed: 'Politically Exposed Person - State Duma Member', dateListed: '2023-09-01', country: 'RU', aliases: ['N. Sokolova'] },
    { id: 'OFAC-006', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Banco Delta Asia', entityType: 'Business', reasonListed: 'Sanctions Program: DPRK', dateListed: '2005-09-15', country: 'MO', aliases: ['BDA', 'Delta Asia Financial'] },
    { id: 'EU-004', listName: 'EU Consolidated Sanctions', listId: 'EU-CONSOL-2024', entityName: 'Dmitri Kozlov', entityType: 'Individual', reasonListed: 'EU Council Decision 2023/xxx', dateListed: '2023-07-15', country: 'RU', aliases: ['D. Kozlov', 'Dmitri K.'] },
    { id: 'OFAC-007', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Tehran Petrochemical Co', entityType: 'Business', reasonListed: 'Sanctions Program: IRAN', dateListed: '2018-11-05', country: 'IR', aliases: ['Tehran Petrochem', 'TPC Iran'] },
    { id: 'UN-003', listName: 'UN Consolidated List', listId: 'UN-CONSOL-2024', entityName: 'Kim Chol-su', entityType: 'Individual', reasonListed: 'UN Security Council Resolution 2371', dateListed: '2017-08-05', country: 'KP', aliases: ['Kim Cholsu'] },
    { id: 'OFAC-008', listName: 'OFAC SDN', listId: 'OFAC-SDN-2024', entityName: 'Petromax Energy Corp', entityType: 'Business', reasonListed: 'Sanctions Program: VENEZUELA', dateListed: '2020-02-18', country: 'VE', aliases: ['Petromax', 'Petromax Energy'] },
    { id: 'EU-005', listName: 'EU Consolidated Sanctions', listId: 'EU-CONSOL-2024', entityName: 'Belarusian Industrial Bank', entityType: 'Business', reasonListed: 'EU Council Regulation 765/2006', dateListed: '2021-06-24', country: 'BY', aliases: ['BIB', 'Belarus Ind Bank'] },
  ];

  // --- Fuzzy Matching ---
  function bigrams(str) {
    const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = new Set();
    for (let i = 0; i < s.length - 1; i++) b.add(s.substring(i, i + 2));
    return b;
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    const ba = bigrams(a), bb = bigrams(b);
    let intersection = 0;
    for (const bg of ba) if (bb.has(bg)) intersection++;
    const union = ba.size + bb.size;
    if (union === 0) return 0;
    return Math.round((2 * intersection / union) * 100);
  }

  function bestMatch(inputName, watchlistEntry) {
    let best = similarity(inputName, watchlistEntry.entityName);
    for (const alias of (watchlistEntry.aliases || [])) {
      best = Math.max(best, similarity(inputName, alias));
    }
    return best;
  }

  function screenEntity(entity, recordId) {
    const inputName = entity.Name?.Full || [entity.Name?.First, entity.Name?.Last].filter(Boolean).join(' ') || '';
    const matches = [];
    for (const wl of WATCHLIST) {
      const score = bestMatch(inputName, wl);
      if (score >= 25) {
        matches.push({
          File: { ID: wl.listId, Name: wl.listName },
          EntityScore: score,
          BestName: wl.entityName,
          BestNameScore: score,
          EntityType: wl.entityType,
          ReasonListed: wl.reasonListed,
          DateListed: wl.dateListed,
          Country: wl.country,
          WatchlistEntryId: wl.id,
          Addresses: entity.Addresses?.length ? [{ InputValue: formatAddress(entity.Addresses[0]), ListValue: wl.country, Score: wl.country && entity.Addresses[0]?.Country === wl.country ? 100 : 0, Type: 'Current' }] : [],
          IDs: [],
          DOBs: []
        });
      }
    }
    matches.sort((a, b) => b.EntityScore - a.EntityScore);
    return matches;
  }

  function formatAddress(addr) {
    if (!addr) return '';
    return [addr.Street1, addr.City, addr.StateProvince, addr.PostalCode, addr.Country].filter(Boolean).join(', ');
  }

  // --- Token Interface ---
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
    const now = Math.floor(Date.now() / 1000);
    const entry = { token, expiresAt: Date.now() + 3600000 };
    tokens.set(token, entry);
    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_on: now + 3600,
      not_before: now,
      resource: `https://mock-xg5.example.com/LN.WebServices`
    };
  }

  function validateToken(token) {
    const entry = tokens.get(token);
    return entry && entry.expiresAt > Date.now();
  }

  // --- Lists Interface ---
  function listsDataFiles() {
    return {
      DataFiles: [
        { ID: 'OFAC-SDN-2024', Name: 'OFAC SDN List', Type: 'SDF', RecordCount: 12500, LastUpdated: '2026-02-12T08:00:00Z' },
        { ID: 'EU-CONSOL-2024', Name: 'EU Consolidated Sanctions', Type: 'SDF', RecordCount: 8200, LastUpdated: '2026-02-11T12:00:00Z' },
        { ID: 'UN-CONSOL-2024', Name: 'UN Consolidated List', Type: 'SDF', RecordCount: 6100, LastUpdated: '2026-02-10T16:00:00Z' },
        { ID: 'WC-PEP-2024', Name: 'WorldCompliance PEP Database', Type: 'SDF', RecordCount: 42000, LastUpdated: '2026-02-12T06:00:00Z' },
        { ID: 'CUSTOM-001', Name: 'Internal Watchlist', Type: 'BDF', RecordCount: 150, LastUpdated: '2026-02-01T09:00:00Z' }
      ]
    };
  }

  function listsSearch(request) {
    const searchReq = request.EntitySearchRequest || request;
    const config = searchReq.Configuration || {};
    const input = searchReq.Input || {};
    const inputRecords = input.Records || [];

    const runId = nextRunId++;
    const now = new Date().toISOString();
    const resultRecords = [];

    for (const rec of inputRecords) {
      const resultId = nextResultId++;
      const entity = rec.Entity || {};
      const watchlistMatches = screenEntity(entity, rec.RecordID || resultId);
      const hasMatches = watchlistMatches.length > 0;
      const topScore = hasMatches ? watchlistMatches[0].EntityScore : 0;

      const record = {
        Record: rec.RecordID || resultId,
        ResultID: resultId,
        RunID: runId,
        RecordStatus: hasMatches ? 'Matches Found' : 'No Matches',
        HasScreeningListMatches: hasMatches,
        Details: {
          InputEntity: entity,
          InputName: entity.Name || {},
          InputAddress: entity.Addresses || [],
          InputID: entity.IDs || [],
        },
        WatchlistResults: watchlistMatches,
        RecordState: {
          AlertState: hasMatches ? 'Open' : 'Closed',
          Status: hasMatches ? 'Pending Review' : 'Auto-Cleared',
          AddedToAcceptList: false,
          Division: config.AssignResultTo?.Division || 'Compliance',
          AssignedTo: config.AssignResultTo?.RolesOrUsers || ['ComplianceTeam'],
          AssignmentType: config.AssignResultTo?.Type || 'Role',
          Note: '',
          History: [{
            Date: now,
            Event: 'Record Created',
            User: 'System',
            Note: `Screening via predefined search: ${config.PredefinedSearchName || 'Default'}`
          }],
          MatchStates: watchlistMatches.map(m => ({ MatchID: m.WatchlistEntryId, Type: null }))
        },
        _meta: { topScore, inputName: entity.Name?.Full || [entity.Name?.First, entity.Name?.Last].filter(Boolean).join(' ') }
      };

      records.set(resultId, record);
      resultRecords.push(record);
    }

    const runInfo = {
      RunID: runId,
      DateCreated: now,
      DateCompleted: now,
      Status: 'Completed',
      RecordCount: resultRecords.length,
      MatchCount: resultRecords.filter(r => r.HasScreeningListMatches).length,
      PredefinedSearchName: config.PredefinedSearchName || 'Default',
      BlockID: input.BlockID || null
    };
    runs.set(runId, runInfo);

    return {
      SearchResults: {
        BlockID: input.BlockID || null,
        ClientReference: searchReq.ClientContext?.ClientReference || null,
        SearchEngineVersion: '5.0.0.1764',
        Records: resultRecords
      }
    };
  }

  // --- Results Interface ---
  function resultsRecord(resultId) {
    const rec = records.get(resultId);
    if (!rec) return { error: { Code: 404, Message: `Record ${resultId} not found` } };
    return rec;
  }

  function resultsSearchRecords(criteria) {
    let results = Array.from(records.values());
    if (criteria) {
      if (criteria.RunID) results = results.filter(r => r.RunID === criteria.RunID);
      if (criteria.AlertState) results = results.filter(r => r.RecordState.AlertState === criteria.AlertState);
      if (criteria.Status) results = results.filter(r => r.RecordState.Status === criteria.Status);
      if (criteria.HasMatches !== undefined) results = results.filter(r => r.HasScreeningListMatches === criteria.HasMatches);
    }
    return { Records: results };
  }

  function resultsSetRecordState(resultId, newState) {
    const rec = records.get(resultId);
    if (!rec) return { error: { Code: 404, Message: `Record ${resultId} not found` } };

    const now = new Date().toISOString();
    const oldState = { ...rec.RecordState };

    if (newState.AlertState) rec.RecordState.AlertState = newState.AlertState;
    if (newState.Status) rec.RecordState.Status = newState.Status;
    if (newState.Note) rec.RecordState.Note = newState.Note;
    if (newState.AssignedTo) rec.RecordState.AssignedTo = newState.AssignedTo;
    if (newState.AssignmentType) rec.RecordState.AssignmentType = newState.AssignmentType;
    if (newState.Division) rec.RecordState.Division = newState.Division;
    if (newState.AddedToAcceptList !== undefined) rec.RecordState.AddedToAcceptList = newState.AddedToAcceptList;
    if (newState.MatchStates) rec.RecordState.MatchStates = newState.MatchStates;

    rec.RecordState.History.push({
      Date: now,
      Event: newState.AlertState === 'Closed' ? 'Alert Opened or Closed' : 'Alert Decision Applied',
      User: newState._user || 'ComplianceOfficer',
      Note: newState.Note || `State changed: ${oldState.AlertState} → ${rec.RecordState.AlertState}`
    });

    return { Success: true };
  }

  function resultsRun(runId) {
    const run = runs.get(runId);
    if (!run) return { error: { Code: 404, Message: `Run ${runId} not found` } };
    return run;
  }

  function resultsSearchRuns(criteria) {
    let results = Array.from(runs.values());
    if (criteria?.Status) results = results.filter(r => r.Status === criteria.Status);
    return { Runs: results };
  }

  // --- Webhook Support ---
  async function sha256Base64(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  async function hmacSha256Base64(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  async function generateWebhookPayload(resultId, eventType, options = {}) {
    const rec = records.get(resultId);
    const now = new Date();
    const dateStr = now.toUTCString();
    const host = options.host || 'bankconnector.example.com:443';
    const path = options.path || '/api/bridger/webhook';
    const secret = options.secret || 'mock-webhook-secret-key-2026';

    const payload = {
      ResultId: resultId,
      EventType: eventType === 'AlertStateClosed' ? 'AlertClosed' : 'AlertDecisionApplied',
      Status: rec?.RecordState?.Status || options.status || 'Pending Review',
      DateCreated: rec?.RecordState?.History?.[0]?.Date || now.toISOString(),
      DateModified: now.toISOString(),
      State: rec?.RecordState?.AlertState || options.state || 'Open',
      AssignedTo: rec?.RecordState?.AssignedTo?.[0] || options.assignedTo || 'ComplianceTeam',
      AssignmentType: rec?.RecordState?.AssignmentType || 'Role',
    };
    if (rec?.RecordState?.Note) payload.Note = 1;
    if (options.decisionTags) payload.DecisionTags = options.decisionTags;
    if (rec?.RecordState?.AddedToAcceptList) payload.AddedToAcceptList = 1;

    const payloadJson = JSON.stringify(payload);
    const contentHash = await sha256Base64(payloadJson);
    const stringToSign = `POST\n${path}\n${dateStr};${host};${contentHash}`;
    const signature = await hmacSha256Base64(secret, stringToSign);

    const headers = {
      'x-ms-date': dateStr,
      'x-ms-content-sha256': contentHash,
      'Authorization': `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      'Content-Type': 'application/json'
    };

    const entry = { payload, payloadJson, headers, stringToSign, contentHash, signature, timestamp: now.toISOString() };
    webhookLog.push(entry);
    return entry;
  }

  async function validateWebhookSignature(payloadJson, headers, secret, host, path) {
    const steps = [];

    // Step 1: Verify content hash
    const computedHash = await sha256Base64(payloadJson);
    const receivedHash = headers['x-ms-content-sha256'];
    const hashValid = computedHash === receivedHash;
    steps.push({ step: 'Content Hash', computed: computedHash, received: receivedHash, valid: hashValid });

    // Step 2: Reconstruct string to sign
    const dateStr = headers['x-ms-date'];
    const stringToSign = `POST\n${path}\n${dateStr};${host};${computedHash}`;
    steps.push({ step: 'String to Sign', value: stringToSign });

    // Step 3: Compute HMAC
    const computedSig = await hmacSha256Base64(secret, stringToSign);
    steps.push({ step: 'Computed HMAC', value: computedSig });

    // Step 4: Extract received signature
    const authHeader = headers['Authorization'] || '';
    const sigMatch = authHeader.match(/Signature=(.+)$/);
    const receivedSig = sigMatch ? sigMatch[1] : '';
    const sigValid = computedSig === receivedSig;
    steps.push({ step: 'Signature Compare', computed: computedSig, received: receivedSig, valid: sigValid });

    return { valid: hashValid && sigValid, steps };
  }

  // --- Screening Threshold Logic ---
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
        decision = 'Hold for Review';
      }

      return {
        ...rec,
        screening: { traxStatus, traxCode, decision, topScore, thresholds: { autoAccept, autoReject } }
      };
    });
  }

  // --- Utility ---
  function getState() {
    return {
      tokenCount: tokens.size,
      runCount: runs.size,
      recordCount: records.size,
      webhookLogCount: webhookLog.length,
      runs: Array.from(runs.values()),
      records: Array.from(records.values()),
      webhookLog: [...webhookLog]
    };
  }

  function reset() {
    tokens.clear();
    runs.clear();
    records.clear();
    webhookLog.length = 0;
    nextRunId = 100001;
    nextResultId = 200001;
  }

  // --- Public API ---
  return {
    tokenIssue,
    validateToken,
    listsDataFiles,
    listsSearch,
    resultsRecord,
    resultsSearchRecords,
    resultsSetRecordState,
    resultsRun,
    resultsSearchRuns,
    generateWebhookPayload,
    validateWebhookSignature,
    applyThresholds,
    getState,
    reset,
    WATCHLIST,
    sha256Base64,
    hmacSha256Base64
  };
})();
