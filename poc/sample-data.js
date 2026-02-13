/**
 * Sample Data for Bridger POC Tools
 *
 * Contains sample pain.001.001.03 XML files and helper functions.
 */
const SampleData = (() => {

  // --- pain.001.001.03 Sample Files ---

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
      <NbOfTxs>3</NbOfTxs>
      <CtrlSum>125000.00</CtrlSum>
      <ReqdExctnDt>2026-02-14</ReqdExctnDt>
      <Dbtr>
        <Nm>Acme Corporation</Nm>
        <PstlAdr>
          <StrtNm>100 Main Street</StrtNm>
          <PstCd>10001</PstCd>
          <TwnNm>New York</TwnNm>
          <Ctry>US</Ctry>
        </PstlAdr>
        <Id><OrgId><Othr><Id>US-EIN-123456789</Id></Othr></OrgId></Id>
      </Dbtr>
      <DbtrAcct><Id><IBAN>US33ACME00012345678901</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>CHASUS33XXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-001</InstrId>
          <EndToEndId>E2E-2026-001</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="EUR">50000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>DEUTDEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Schneider Manufacturing GmbH</Nm>
          <PstlAdr>
            <StrtNm>Industriestrasse 42</StrtNm>
            <PstCd>80331</PstCd>
            <TwnNm>Munich</TwnNm>
            <Ctry>DE</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Invoice INV-2026-0042 - Machine parts</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-002</InstrId>
          <EndToEndId>E2E-2026-002</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="GBP">25000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BARCGB22XXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Williams Consulting Ltd</Nm>
          <PstlAdr>
            <StrtNm>14 Baker Street</StrtNm>
            <PstCd>W1U 3BW</PstCd>
            <TwnNm>London</TwnNm>
            <Ctry>GB</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>GB29NWBK60161331926819</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Consulting fees Q1 2026</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-003</InstrId>
          <EndToEndId>E2E-2026-003</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="USD">50000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BNPAFRPPXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Dupont Technologies SA</Nm>
          <PstlAdr>
            <StrtNm>15 Rue de la Paix</StrtNm>
            <PstCd>75002</PstCd>
            <TwnNm>Paris</TwnNm>
            <Ctry>FR</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>FR7630006000011234567890189</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Software license renewal 2026</Ustrd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  const MIXED = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG-2026-0213-002</MsgId>
      <CreDtTm>2026-02-13T10:30:00</CreDtTm>
      <NbOfTxs>5</NbOfTxs>
      <CtrlSum>487500.00</CtrlSum>
      <InitgPty>
        <Nm>Global Imports Inc</Nm>
        <Id><OrgId><BICOrBEI>GLOBUS33XXX</BICOrBEI></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-BATCH-002</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>5</NbOfTxs>
      <CtrlSum>487500.00</CtrlSum>
      <ReqdExctnDt>2026-02-14</ReqdExctnDt>
      <Dbtr>
        <Nm>Global Imports Inc</Nm>
        <PstlAdr>
          <StrtNm>500 Trade Center Blvd</StrtNm>
          <PstCd>33131</PstCd>
          <TwnNm>Miami</TwnNm>
          <Ctry>US</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct><Id><IBAN>US44GLOB00098765432101</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>CITIUS33XXX</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-010</InstrId>
          <EndToEndId>E2E-2026-010</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="EUR">75000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Becker Automotive Parts AG</Nm>
          <PstlAdr>
            <StrtNm>Hauptstrasse 8</StrtNm>
            <PstCd>70173</PstCd>
            <TwnNm>Stuttgart</TwnNm>
            <Ctry>DE</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>DE44500105175407324931</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>PO-2026-1001 Auto parts shipment</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-011</InstrId>
          <EndToEndId>E2E-2026-011</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="USD">120000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BKCHCNBJXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Ahmad Trading Co</Nm>
          <PstlAdr>
            <StrtNm>45 Commerce Road</StrtNm>
            <PstCd>12345</PstCd>
            <TwnNm>Dubai</TwnNm>
            <Ctry>AE</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>AE070331234567890123456</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Textiles import - Container MSKU1234567</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-012</InstrId>
          <EndToEndId>E2E-2026-012</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="CHF">92500.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>UBSWCHZH80A</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Volkov Industries AG</Nm>
          <PstlAdr>
            <StrtNm>Bahnhofstrasse 21</StrtNm>
            <PstCd>8001</PstCd>
            <TwnNm>Zurich</TwnNm>
            <Ctry>CH</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>CH9300762011623852957</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Industrial equipment - Contract C-4455</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-013</InstrId>
          <EndToEndId>E2E-2026-013</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="JPY">10000000</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BOABORJPXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Tanaka Electronics Co Ltd</Nm>
          <PstlAdr>
            <StrtNm>3-1-1 Marunouchi</StrtNm>
            <PstCd>100-0005</PstCd>
            <TwnNm>Tokyo</TwnNm>
            <Ctry>JP</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>JP1234567890123456789012</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Semiconductor components - Order SO-7788</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-014</InstrId>
          <EndToEndId>E2E-2026-014</EndToEndId>
        </PmtId>
        <Amt><InstdAmt Ccy="USD">200000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BKTRUS33XXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Petromax Energy Corporation</Nm>
          <PstlAdr>
            <StrtNm>Av. Libertador 1234</StrtNm>
            <PstCd>1001</PstCd>
            <TwnNm>Caracas</TwnNm>
            <Ctry>VE</Ctry>
          </PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>VE89000000001234567890</IBAN></Id></CdtrAcct>
        <UltmtCdtr><Nm>Carlos Mendez</Nm></UltmtCdtr>
        <RmtInf><Ustrd>Energy consulting services Q4 2025</Ustrd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  const BATCH = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG-2026-0213-003</MsgId>
      <CreDtTm>2026-02-13T14:00:00</CreDtTm>
      <NbOfTxs>8</NbOfTxs>
      <CtrlSum>1835000.00</CtrlSum>
      <InitgPty>
        <Nm>Meridian Holdings Group</Nm>
        <Id><OrgId><BICOrBEI>MERDHK22XXX</BICOrBEI></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-BATCH-003A</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>4</NbOfTxs>
      <CtrlSum>520000.00</CtrlSum>
      <ReqdExctnDt>2026-02-15</ReqdExctnDt>
      <Dbtr>
        <Nm>Meridian Holdings Group</Nm>
        <PstlAdr>
          <StrtNm>88 Queensway</StrtNm>
          <PstCd>HK</PstCd>
          <TwnNm>Hong Kong</TwnNm>
          <Ctry>HK</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct><Id><IBAN>HK8012345678901234567</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>HSBCHKHHHKH</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-020</InstrId><EndToEndId>E2E-2026-020</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="USD">150000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>SCBLSGSGXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Pacific Shipping Pte Ltd</Nm>
          <PstlAdr><TwnNm>Singapore</TwnNm><Ctry>SG</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>SG1234567890123456</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Freight charges - BL MSKU9988776</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-021</InstrId><EndToEndId>E2E-2026-021</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="USD">80000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>ANABORUAXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Hassan Al Rahman Trading</Nm>
          <PstlAdr><StrtNm>Al Hamra Tower</StrtNm><TwnNm>Damascus</TwnNm><Ctry>SY</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>SY0012345678901234567890</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Commodity trading - Ref CT-2288</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-022</InstrId><EndToEndId>E2E-2026-022</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">190000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BPABORUAXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Belarusian Industrial Banking</Nm>
          <PstlAdr><TwnNm>Minsk</TwnNm><Ctry>BY</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>BY13NBRB00000000000000000000</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Inter-bank settlement - Ref IB-9900</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-023</InstrId><EndToEndId>E2E-2026-023</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="USD">100000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>MABORUMMXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Mediterranean Trade Solutions</Nm>
          <PstlAdr><TwnNm>Casablanca</TwnNm><Ctry>MA</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>MA64011519000001205000534921</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Olive oil import - Season 2025/2026</Ustrd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
    <PmtInf>
      <PmtInfId>PMT-BATCH-003B</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>4</NbOfTxs>
      <CtrlSum>1315000.00</CtrlSum>
      <ReqdExctnDt>2026-02-16</ReqdExctnDt>
      <Dbtr>
        <Nm>Meridian Holdings Group</Nm>
        <PstlAdr>
          <StrtNm>88 Queensway</StrtNm>
          <TwnNm>Hong Kong</TwnNm>
          <Ctry>HK</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct><Id><IBAN>HK8012345678901234567</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>HSBCHKHHHKH</BIC></FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-024</InstrId><EndToEndId>E2E-2026-024</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="USD">250000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>ABORUMMXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Kim Chol Su Enterprises</Nm>
          <PstlAdr><TwnNm>Pyongyang</TwnNm><Ctry>KP</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>KP000000000000000000</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Mineral resources - Contract MR-5566</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-025</InstrId><EndToEndId>E2E-2026-025</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">315000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>BBRUBEBB010</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Van den Berg Logistics NV</Nm>
          <PstlAdr><StrtNm>Koningsstraat 44</StrtNm><TwnNm>Brussels</TwnNm><Ctry>BE</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>BE68539007547034</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Warehousing and distribution Q1 2026</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-026</InstrId><EndToEndId>E2E-2026-026</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="USD">500000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>IABORUBOXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Natalia Sokolova Consulting</Nm>
          <PstlAdr><StrtNm>Tverskaya 15</StrtNm><TwnNm>Moscow</TwnNm><Ctry>RU</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>RU0204452560040702810412345678</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Strategic advisory services 2025-2026</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><InstrId>INSTR-027</InstrId><EndToEndId>E2E-2026-027</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="USD">250000.00</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>ABABORUAXXX</BIC></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>Al Noor Charitable Foundation</Nm>
          <PstlAdr><TwnNm>Kabul</TwnNm><Ctry>AF</Ctry></PstlAdr>
        </Cdtr>
        <CdtrAcct><Id><IBAN>AF0000000000000000000000</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Humanitarian aid contribution 2026</Ustrd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  const SAMPLES = {
    simple: { name: 'Simple (3 clean payments)', xml: SIMPLE },
    mixed: { name: 'Mixed (2 clean + 3 suspicious)', xml: MIXED },
    batch: { name: 'Batch (8 payments, multi-block)', xml: BATCH }
  };

  // --- pain.001 Parser ---
  function parsePain001(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('XML parse error: ' + err.textContent);

    const ns = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03';
    const sel = (parent, tag) => parent.getElementsByTagNameNS(ns, tag)[0] || parent.getElementsByTagName(tag)[0];
    const selAll = (parent, tag) => {
      const r = parent.getElementsByTagNameNS(ns, tag);
      return r.length ? r : parent.getElementsByTagName(tag);
    };
    const txt = (parent, tag) => {
      const el = sel(parent, tag);
      return el ? el.textContent.trim() : '';
    };

    const root = sel(doc, 'CstmrCdtTrfInitn');
    if (!root) throw new Error('Not a valid pain.001.001.03 document');

    const grpHdr = sel(root, 'GrpHdr');
    const header = {
      msgId: txt(grpHdr, 'MsgId'),
      creDtTm: txt(grpHdr, 'CreDtTm'),
      nbOfTxs: txt(grpHdr, 'NbOfTxs'),
      ctrlSum: txt(grpHdr, 'CtrlSum'),
      initgPty: txt(sel(grpHdr, 'InitgPty'), 'Nm')
    };

    const pmtInfs = selAll(root, 'PmtInf');
    const batches = [];
    const allParties = [];

    for (const pmtInf of pmtInfs) {
      const dbtrEl = sel(pmtInf, 'Dbtr');
      const debtor = parseParty(dbtrEl, txt, sel);
      const batch = {
        pmtInfId: txt(pmtInf, 'PmtInfId'),
        pmtMtd: txt(pmtInf, 'PmtMtd'),
        nbOfTxs: txt(pmtInf, 'NbOfTxs'),
        ctrlSum: txt(pmtInf, 'CtrlSum'),
        reqdExctnDt: txt(pmtInf, 'ReqdExctnDt'),
        debtor,
        debtorAccount: txt(pmtInf, 'IBAN') || txt(pmtInf, 'Othr'),
        debtorAgent: txt(sel(pmtInf, 'DbtrAgt') || pmtInf, 'BIC'),
        transactions: []
      };

      allParties.push({ type: 'Debtor', name: debtor.name, address: debtor.address, source: batch.pmtInfId });

      const txns = selAll(pmtInf, 'CdtTrfTxInf');
      for (const txn of txns) {
        const cdtrEl = sel(txn, 'Cdtr');
        const creditor = parseParty(cdtrEl, txt, sel);
        const ultmtCdtrEl = sel(txn, 'UltmtCdtr');
        const ultimateCreditor = ultmtCdtrEl ? parseParty(ultmtCdtrEl, txt, sel) : null;

        const amtEl = sel(txn, 'InstdAmt');
        const transaction = {
          instrId: txt(txn, 'InstrId'),
          endToEndId: txt(txn, 'EndToEndId'),
          amount: amtEl ? amtEl.textContent.trim() : '',
          currency: amtEl ? amtEl.getAttribute('Ccy') : '',
          creditor,
          creditorAccount: (() => {
            const cdtrAcct = sel(txn, 'CdtrAcct');
            return cdtrAcct ? (txt(cdtrAcct, 'IBAN') || txt(cdtrAcct, 'Othr')) : '';
          })(),
          creditorAgent: (() => {
            const cdtrAgt = sel(txn, 'CdtrAgt');
            return cdtrAgt ? txt(cdtrAgt, 'BIC') : '';
          })(),
          ultimateCreditor,
          remittanceInfo: txt(txn, 'Ustrd')
        };

        batch.transactions.push(transaction);
        allParties.push({ type: 'Creditor', name: creditor.name, address: creditor.address, source: transaction.endToEndId });
        if (ultimateCreditor) {
          allParties.push({ type: 'Ultimate Creditor', name: ultimateCreditor.name, address: ultimateCreditor.address, source: transaction.endToEndId });
        }
      }
      batches.push(batch);
    }

    return { header, batches, allParties };
  }

  function parseParty(el, txt, sel) {
    if (!el) return { name: '', address: {} };
    const addrEl = sel(el, 'PstlAdr');
    return {
      name: txt(el, 'Nm'),
      address: addrEl ? {
        street: txt(addrEl, 'StrtNm'),
        postCode: txt(addrEl, 'PstCd'),
        city: txt(addrEl, 'TwnNm'),
        country: txt(addrEl, 'Ctry')
      } : {}
    };
  }

  // --- Convert parsed payment to Bridger search entities ---
  function paymentToEntities(parsed) {
    const entities = [];
    let recordId = 1;

    for (const batch of parsed.batches) {
      for (const txn of batch.transactions) {
        // Creditor entity
        entities.push({
          RecordID: recordId++,
          Entity: {
            EntityType: 'Unknown',
            Name: { Full: txn.creditor.name },
            Addresses: txn.creditor.address?.country ? [{
              Street1: txn.creditor.address.street || '',
              City: txn.creditor.address.city || '',
              PostalCode: txn.creditor.address.postCode || '',
              Country: txn.creditor.address.country || '',
              Type: 'Current'
            }] : [],
            IDs: txn.creditorAccount ? [{ Number: txn.creditorAccount, Type: 'IBAN' }] : []
          },
          _paymentRef: txn.endToEndId,
          _partyType: 'Creditor',
          _amount: txn.amount,
          _currency: txn.currency,
          _debtorName: batch.debtor.name,
          _remittance: txn.remittanceInfo
        });

        // Ultimate creditor if present
        if (txn.ultimateCreditor?.name) {
          entities.push({
            RecordID: recordId++,
            Entity: {
              EntityType: 'Unknown',
              Name: { Full: txn.ultimateCreditor.name },
              Addresses: txn.ultimateCreditor.address?.country ? [{
                Country: txn.ultimateCreditor.address.country,
                Type: 'Current'
              }] : [],
              IDs: []
            },
            _paymentRef: txn.endToEndId,
            _partyType: 'Ultimate Creditor',
            _amount: txn.amount,
            _currency: txn.currency,
            _debtorName: batch.debtor.name,
            _remittance: txn.remittanceInfo
          });
        }
      }
    }
    return entities;
  }

  return { SAMPLES, parsePain001, paymentToEntities };
})();
