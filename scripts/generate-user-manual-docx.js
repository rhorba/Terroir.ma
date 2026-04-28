/**
 * Terroir.ma — User Manual DOCX Generator
 * Generates docs/pitch/USER-MANUAL-TEST-SCENARIOS.docx
 * Run: node scripts/generate-user-manual-docx.js
 */

'use strict';

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, BorderStyle,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  UnderlineType,
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ─── Brand ───────────────────────────────────────────────────────────────────
const C = {
  green:    '2D6A4F',
  saffron:  'E9A824',
  cream:    'F9F3E8',
  brown:    '774936',
  dark:     '1A1A1A',
  white:    'FFFFFF',
  slate:    '4A5568',
  light:    'F0EBE1',
  greenBg:  'E8F3EE',
  codeBg:   'F4F4F4',
  blueBg:   'EBF4FF',
  warnBg:   'FFF8E6',
  redBg:    'FEF0F0',
  red:      'C0392B',
  blue:     '2980B9',
};

const FONT = 'Calibri';
const FONT_CODE = 'Courier New';
const OUT = path.resolve(__dirname, '..', 'docs', 'pitch', 'USER-MANUAL-TEST-SCENARIOS.docx');

// ─── Primitive helpers ────────────────────────────────────────────────────────

const r = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });
const rc = (text, opts = {}) => new TextRun({ text, font: FONT_CODE, size: 18, ...opts });

function p(children, opts = {}) {
  const runs = Array.isArray(children) ? children
    : [typeof children === 'string' ? r(children) : children];
  return new Paragraph({ children: runs, ...opts });
}

function sp() { return p('', { spacing: { after: 60 } }); }

function pageBreak() { return p([new PageBreak()]); }

// ─── Styled helpers ───────────────────────────────────────────────────────────

/** Cover title */
function coverTitle(text) {
  return p([r(text, { bold: true, size: 80, color: C.white })], {
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
    spacing: { before: 400, after: 200 },
    indent: { left: 200, right: 200 },
  });
}

function coverSub(text) {
  return p([r(text, { size: 28, color: C.cream, italics: true })], {
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
    spacing: { after: 80 },
    indent: { left: 200, right: 200 },
  });
}

function coverTag(text) {
  return p([r(text, { size: 22, color: C.saffron })], {
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
    spacing: { after: 160 },
    indent: { left: 200, right: 200 },
  });
}

/** Scenario banner (coloured section header) */
function scenarioBanner(num, title, persona, role) {
  return [
    p([r(`SCENARIO ${num}`, { bold: true, size: 36, color: C.white })], {
      alignment: AlignmentType.LEFT,
      shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
      spacing: { before: 400, after: 0 },
      indent: { left: 200, right: 200 },
    }),
    p([r(title.toUpperCase(), { bold: true, size: 28, color: C.saffron })], {
      alignment: AlignmentType.LEFT,
      shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
      spacing: { after: 0 },
      indent: { left: 200, right: 200 },
    }),
    p([r(`Persona: ${persona}  ·  Role: ${role}`, { size: 20, color: C.cream })], {
      alignment: AlignmentType.LEFT,
      shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
      spacing: { after: 200 },
      indent: { left: 200, right: 200 },
    }),
  ];
}

/** H1 — Part heading */
function h1(text) {
  return p([r(text, { bold: true, size: 44, color: C.white })], {
    heading: HeadingLevel.HEADING_1,
    shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
    spacing: { before: 360, after: 160 },
    indent: { left: 200, right: 200 },
  });
}

/** H2 — Step title */
function h2(text) {
  return p([r(text, { bold: true, size: 32, color: C.green })], {
    heading: HeadingLevel.HEADING_2,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.saffron, space: 4 } },
    spacing: { before: 280, after: 100 },
  });
}

/** H3 — sub-step label */
function h3(text) {
  return p([r(text, { bold: true, size: 24, color: C.brown })], {
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 60 },
  });
}

/** Body text */
function body(text, opts = {}) {
  return p([r(text, { size: 22, color: C.dark })], {
    spacing: { after: 80 },
    ...opts,
  });
}

/** Bullet */
function bullet(text, level = 0) {
  return p([r(text, { size: 22, color: C.dark })], {
    bullet: { level },
    spacing: { after: 60 },
  });
}

/** HTTP method + path badge */
function httpBadge(method, path) {
  const methodColor = {
    GET: '27AE60', POST: '2980B9', PATCH: 'E67E22', PUT: '8E44AD', DELETE: 'C0392B',
  }[method] || '7F8C8D';
  return p([
    r(` ${method} `, { bold: true, size: 20, color: C.white,
      shading: { type: ShadingType.SOLID, color: methodColor, fill: methodColor } }),
    r('  ', { size: 20 }),
    rc(path, { size: 20, bold: true, color: C.dark }),
  ], { spacing: { before: 80, after: 20 } });
}

/** Code block */
function codeBlock(lines) {
  const runs = lines.map((line, i) => {
    const parts = [rc(line, { color: C.dark })];
    if (i < lines.length - 1) parts.push(new TextRun({ text: '\n', font: FONT_CODE }));
    return parts;
  }).flat();
  return p(runs, {
    shading: { type: ShadingType.SOLID, color: C.codeBg, fill: C.codeBg },
    border: {
      top:    { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      left:   { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      right:  { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
    indent: { left: 240, right: 240 },
    spacing: { before: 80, after: 80 },
  });
}

/** Info callout (green) */
function infoBox(text) {
  return p([r(text, { size: 20, color: C.green, italics: true })], {
    shading: { type: ShadingType.SOLID, color: C.greenBg, fill: C.greenBg },
    border: { left: { style: BorderStyle.THICK, size: 16, color: C.saffron, space: 6 } },
    indent: { left: 240, right: 240 },
    spacing: { before: 120, after: 120 },
  });
}

/** Warning callout (amber) */
function warnBox(text) {
  return p([r('⚡ ', { size: 20, bold: true, color: C.saffron }), r(text, { size: 20, color: C.dark })], {
    shading: { type: ShadingType.SOLID, color: C.warnBg, fill: C.warnBg },
    border: { left: { style: BorderStyle.THICK, size: 16, color: C.saffron, space: 6 } },
    indent: { left: 240, right: 240 },
    spacing: { before: 120, after: 120 },
  });
}

/** Kafka event note */
function kafkaNote(events) {
  const runs = [r('Kafka events fired:  ', { bold: true, size: 20, color: C.blue })];
  events.forEach((e, i) => {
    runs.push(rc(e, { size: 18, color: C.blue }));
    if (i < events.length - 1) runs.push(r('  ·  ', { size: 20, color: C.slate }));
  });
  return p(runs, {
    shading: { type: ShadingType.SOLID, color: C.blueBg, fill: C.blueBg },
    indent: { left: 240, right: 240 },
    spacing: { before: 100, after: 60 },
  });
}

/** Notification note */
function notifNote(text) {
  return p([r('Notification:  ', { bold: true, size: 20, color: C.green }), r(text, { size: 20, color: C.dark })], {
    shading: { type: ShadingType.SOLID, color: C.greenBg, fill: C.greenBg },
    indent: { left: 240, right: 240 },
    spacing: { before: 0, after: 120 },
  });
}

/** Divider */
function divider() {
  return p('', {
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.saffron, space: 2 } },
    spacing: { before: 100, after: 100 },
  });
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function trow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((cell) =>
      new TableCell({
        children: [p([r(cell, {
          bold: isHeader, size: isHeader ? 18 : 16,
          color: isHeader ? C.white : C.dark,
        })], { alignment: AlignmentType.LEFT })],
        shading: isHeader
          ? { type: ShadingType.SOLID, color: C.green, fill: C.green }
          : { type: ShadingType.CLEAR, fill: C.white },
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
      }),
    ),
  });
}

function dataTable(rows, colWidths) {
  return new Table({
    rows: rows.map((r2, i) => trow(r2, i === 0)),
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      left:   { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      right:  { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideH:{ style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      insideV:{ style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    },
  });
}

// ─── Build document ───────────────────────────────────────────────────────────

async function build() {

  const children = [];

  const add = (...items) => {
    for (const it of items) {
      if (Array.isArray(it)) it.forEach((x) => children.push(x));
      else children.push(it);
    }
  };

  // ── Cover ──────────────────────────────────────────────────────────────────
  add(
    coverTitle('Terroir.ma'),
    coverSub('User Manual & Test Scenarios'),
    coverSub('Complete How-To Guide — Presentation Edition'),
    coverTag('April 2026  ·  104 Endpoints  ·  9 Roles  ·  12-Step Workflow  ·  Law 25-06 SDOQ'),
    divider(),
    body('This document provides structured test user scenarios for every role in the Terroir.ma platform. Each scenario is self-contained, presentation-ready, and covers one complete user journey end-to-end.'),
    sp(),
  );

  // ── Platform Overview table ───────────────────────────────────────────────
  add(
    h1('PLATFORM OVERVIEW'),
    sp(),
    dataTable([
      ['Layer', 'Technology'],
      ['API', 'NestJS 10 · TypeScript 5.4 strict mode'],
      ['Database', 'PostgreSQL 16 + PostGIS 3.4'],
      ['Event Bus', 'Redpanda (Kafka-compatible) · 18 events'],
      ['Authentication', 'Keycloak 24 · 9 roles · JWT Bearer'],
      ['Cache', 'Redis 7 · QR verification < 200ms p99'],
      ['QR Signing', 'HMAC-SHA256'],
      ['Languages', 'fr-MA · ar-MA · zgh (Tifinagh)'],
    ], [2500, 6500]),
    sp(),
  );

  // ── Persona table ──────────────────────────────────────────────────────────
  add(
    h2('Personas'),
    dataTable([
      ['Persona', 'Role', 'Context'],
      ['Khalid', 'super-admin', 'Platform administrator, MAPMDREF oversight'],
      ['Fatima', 'cooperative-admin', 'President, 28-member saffron cooperative, Taliouine'],
      ['Hassan', 'cooperative-member', 'Field farmer, Fatima\'s cooperative'],
      ['Dr. Amina', 'lab-technician', 'ONSSA-accredited lab chemist, Agadir'],
      ['Youssef', 'inspector', 'Senior field inspector, MAPMDREF appointed'],
      ['Omar', 'certification-body', 'Certification officer, Direction SDOQ'],
      ['Leila', 'customs-agent', 'EACCE customs officer, Casablanca Port'],
      ['Yuki', 'consumer (public)', 'EU sourcing manager, Paris — no account required'],
    ], [1500, 2200, 5300]),
    sp(),
    pageBreak(),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1 — SUPER-ADMIN
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(1, 'Super-Admin: Platform Setup & Oversight', 'Khalid', 'super-admin'));

  add(h2('Step 1.1 — Authenticate'));
  add(httpBadge('POST', '/realms/terroir/protocol/openid-connect/token'));
  add(codeBlock([
    'grant_type=password&client_id=terroir-api',
    '&username=khalid&password=***',
  ]));
  add(body('Response: access_token (JWT). Use as Authorization: Bearer {token} for all subsequent calls.'));
  add(sp());

  add(h2('Step 1.2 — View Platform Dashboard'));
  add(httpBadge('GET', '/admin/dashboard'));
  add(codeBlock([
    '{',
    '  "cooperatives": { "total": 12, "pending": 3, "active": 8 },',
    '  "certifications": { "total": 47, "granted": 31, "pending": 9 },',
    '  "qrScans": { "total": 1248, "last30Days": 234 },',
    '  "labTests": { "total": 54, "passed": 46, "failed": 8 }',
    '}',
  ]));
  add(warnBox('Cached 300 seconds in Redis. Reflects aggregate platform state in real time.'));
  add(sp());

  add(h2('Step 1.3 — Review Pending Cooperatives'));
  add(httpBadge('GET', '/cooperatives?status=pending'));
  add(body('Returns list of cooperatives awaiting verification with ICE, region, president name, and submission timestamp.'));
  add(sp());

  add(h2('Step 1.4 — Verify the Cooperative'));
  add(httpBadge('PATCH', '/cooperatives/{id}/verify'));
  add(codeBlock([
    '// No request body required',
    '// Response:',
    '{ "status": "active", "verifiedAt": "2025-11-03T10:00:00Z" }',
  ]));
  add(kafkaNote(['cooperative.registration.verified']));
  add(notifNote('Fatima receives email + SMS: "Votre coopérative a été vérifiée et activée."'));
  add(sp());

  add(h2('Step 1.5 — Accredit a Laboratory'));
  add(httpBadge('POST', '/labs'));
  add(codeBlock([
    '{',
    '  "name": "Laboratoire ONSSA Agadir",',
    '  "onssaAccreditationNumber": "ONSSA-LAB-2025-AGD-007"',
    '}',
  ]));
  add(httpBadge('POST', '/labs/{labId}/accredit'));
  add(body('Response: { "isAccredited": true, "accreditedAt": "2025-11-03T..." }'));
  add(sp());

  add(h2('Step 1.6 — View Kafka DLQ Stats'));
  add(httpBadge('GET', '/admin/kafka/dlq-stats'));
  add(codeBlock([
    '{',
    '  "lab.test.completed.dlq": 1,',
    '  "certification.decision.granted.dlq": 0',
    '}',
  ]));
  add(warnBox('Non-zero DLQ counts require manual investigation — events have exceeded retry threshold.'));
  add(sp());

  add(infoBox('Scenario 1 Complete: Khalid has verified a cooperative, accredited a lab, reviewed the platform health dashboard, and inspected Kafka DLQ stats.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2 — COOPERATIVE-ADMIN
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(2, 'Cooperative-Admin: Full Cooperative Setup', 'Fatima', 'cooperative-admin'));
  add(body('Pre-condition: Khalid has verified the cooperative. Fatima has JWT with cooperative_id claim.'));
  add(sp());

  add(h2('Step 2.1 — View My Cooperative Profile'));
  add(httpBadge('GET', '/cooperatives/{id}'));
  add(codeBlock([
    '{',
    '  "name": "Coopérative Safran Taliouine",',
    '  "nameAr": "تعاونية زعفران تالوين",',
    '  "ice": "002154789012345",',
    '  "regionCode": "DRAA_TAFILALET",',
    '  "status": "active",',
    '  "productTypes": ["SAFFRON"]',
    '}',
  ]));
  add(sp());

  add(h2('Step 2.2 — Add a Member'));
  add(httpBadge('POST', '/cooperatives/{id}/members'));
  add(codeBlock([
    '{',
    '  "fullName": "Hassan Oubella",',
    '  "fullNameAr": "حسن أوبيلة",',
    '  "cin": "J123456",',
    '  "phone": "+212662345678",',
    '  "email": "hassan@coop-safran.ma",',
    '  "role": "member"',
    '}',
  ]));
  add(kafkaNote(['cooperative.member.added']));
  add(sp());

  add(h2('Step 2.3 — Register a Farm (with GPS)'));
  add(httpBadge('POST', '/cooperatives/{id}/farms'));
  add(codeBlock([
    '{',
    '  "name": "Parcelle Nord Taliouine — Lot 3",',
    '  "areaHectares": 2.5,',
    '  "cropTypes": ["SAFFRON"],',
    '  "regionCode": "DRAA_TAFILALET",',
    '  "commune": "Taliouine",',
    '  "latitude": 30.5321,',
    '  "longitude": -7.9241',
    '}',
  ]));
  add(body('GPS stored as PostGIS geography(Point, 4326). Coordinates validated against DRAA_TAFILALET region bounding box.'));
  add(sp());

  add(infoBox('Scenario 2 Complete: Fatima has a verified cooperative profile, one registered member (Hassan), and one GPS-mapped farm.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3 — COOPERATIVE-MEMBER
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(3, 'Cooperative-Member: Harvest & Batch Logging', 'Hassan', 'cooperative-member'));
  add(sp());

  add(h2('Step 3.1 — Log a Harvest'));
  add(httpBadge('POST', '/harvests'));
  add(codeBlock([
    '{',
    '  "farmId": "farm-uuid-001",',
    '  "productTypeCode": "SAFFRON",',
    '  "quantityKg": 12.5,',
    '  "harvestDate": "2025-10-28",',
    '  "campaignYear": "2025/2026",',
    '  "method": "Cueillette manuelle des pistils — récolte à l\'aube",',
    '  "metadata": { "pickerCount": 8, "altitudeM": 1650 }',
    '}',
  ]));
  add(warnBox('Campaign year auto-computed: October 28 → 2025/2026. October 1 = start of new campaign.'));
  add(sp());

  add(h2('Step 3.2 — Create a Production Batch'));
  add(httpBadge('POST', '/batches'));
  add(codeBlock([
    '{',
    '  "harvestIds": ["harvest-uuid-001"],',
    '  "totalQuantityKg": 12.5',
    '}',
  ]));
  add(codeBlock([
    '// Response:',
    '{',
    '  "batchNumber": "BATCH-SAFFRON-2025-001",',
    '  "status": "created",',
    '  "totalQuantityKg": "12.50"',
    '}',
  ]));
  add(kafkaNote(['product.batch.created']));
  add(sp());

  add(h2('Step 3.3 — Add Processing Steps (×3)'));
  add(httpBadge('POST', '/batches/{id}/processing-steps'));
  add(codeBlock([
    '// Step 1 — DRYING',
    '{ "stepType": "DRYING", "doneAt": "2025-10-29T08:00:00Z",',
    '  "notes": "Séchage à l\'ombre pendant 3 jours, humidité 42%" }',
    '',
    '// Step 2 — SORTING',
    '{ "stepType": "SORTING", "doneAt": "2025-11-01T09:00:00Z",',
    '  "notes": "Tri manuel — sélection Grade 1 uniquement" }',
    '',
    '// Step 3 — PACKAGING',
    '{ "stepType": "PACKAGING", "doneAt": "2025-11-02T14:00:00Z",',
    '  "notes": "Sachets hermétiques 1g — ref PKG-SAF-001" }',
  ]));
  add(infoBox('Processing steps are append-only (immutable). No update or delete endpoint exists. Forms a permanent audit trail.'));
  add(sp());

  add(infoBox('Scenario 3 Complete: Hassan logged 12.5 kg saffron harvest (GPS-linked farm), created batch BATCH-SAFFRON-2025-001, documented 3 processing steps.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4 — LAB TECHNICIAN
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(4, 'Lab Technician: ISO 3632 Analysis', 'Dr. Amina', 'lab-technician'));
  add(sp());

  add(h2('Step 4.1 — Fatima Submits Lab Test'));
  add(httpBadge('POST', '/lab-tests'));
  add(codeBlock([
    '{',
    '  "batchId": "batch-uuid-001",',
    '  "laboratoryId": "lab-uuid-001",',
    '  "expectedResultDate": "2025-11-15"',
    '}',
  ]));
  add(kafkaNote(['lab.test.submitted']));
  add(notifNote('Dr. Amina receives email: "New lab test assignment — Batch BATCH-SAFFRON-2025-001."'));
  add(sp());

  add(h2('Step 4.2 — Record Lab Analysis Results'));
  add(httpBadge('POST', '/lab-tests/{id}/results'));
  add(codeBlock([
    '{',
    '  "testValues": {',
    '    "crocin_e440": 247,',
    '    "safranal_e330": 34,',
    '    "picrocrocin_e257": 82,',
    '    "moisture_pct": 8.5,',
    '    "ash_total_pct": 5.2',
    '  },',
    '  "technicianName": "Dr. Amina Benali"',
    '}',
  ]));
  add(sp());
  add(h3('ISO 3632 Pass/Fail Evaluation:'));
  add(dataTable([
    ['Parameter', 'Threshold', 'Measured', 'Result'],
    ['Crocin (E1% @ 440nm)', '≥ 190', '247', '✅ PASS'],
    ['Safranal (E1% @ 330nm)', '20 – 50', '34', '✅ PASS'],
    ['Picrocrocin (E1% @ 257nm)', '≥ 70', '82', '✅ PASS'],
    ['Moisture', '≤ 12.0%', '8.5%', '✅ PASS'],
    ['Total ash', '≤ 8.0%', '5.2%', '✅ PASS'],
  ], [3000, 1800, 1800, 2400]));
  add(kafkaNote(['lab.test.completed']));
  add(notifNote('Fatima receives SMS + email: "Résultats labo — Lot BATCH-SAFFRON-2025-001 : CONFORME."'));
  add(sp());

  add(h2('Step 4.3 — Upload PDF Lab Report'));
  add(httpBadge('POST', '/lab-tests/{id}/report'));
  add(codeBlock(['Content-Type: multipart/form-data', 'file=@ISO3632_analysis_BATCH_SAFFRON_2025_001.pdf']));
  add(body('Maximum file size: 20 MB. Stored in MinIO S3-compatible object storage.'));
  add(sp());

  add(infoBox('Scenario 4 Complete: Dr. Amina confirmed 5 ISO 3632 parameters (all passing), uploaded signed PDF. Batch status is now lab-passed.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5 — INSPECTOR
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(5, 'Inspector: Field Inspection & Report', 'Youssef', 'inspector'));
  add(sp());

  add(h2('Step 5.1 — View My Assigned Inspections'));
  add(httpBadge('GET', '/inspections/my'));
  add(body('Returns all inspections assigned to the calling inspector via JWT sub claim.'));
  add(sp());

  add(h2('Step 5.2 — Start Field Visit'));
  add(httpBadge('POST', '/certifications/{id}/start-inspection'));
  add(body('Certification status advances to INSPECTION_IN_PROGRESS.'));
  add(sp());

  add(h2('Step 5.3 — File Inspection Report'));
  add(httpBadge('PATCH', '/inspections/{id}/report'));
  add(codeBlock([
    '{',
    '  "passed": true,',
    '  "summary": "Visite terrain effectuée le 20/11/2025. Parcelle Lot 3',
    '   conforme. Pratiques de cueillette respectent le cahier des charges IGP.",',
    '  "farmFindings": [',
    '    {',
    '      "farmId": "farm-uuid-001",',
    '      "findings": "Zone conforme, altitude 1650m, aucun équipement mécanique.",',
    '      "passed": true',
    '    }',
    '  ],',
    '  "nonConformities": []',
    '}',
  ]));
  add(kafkaNote(['certification.inspection.completed']));
  add(notifNote('Omar (certification-body) receives email: "Rapport d\'inspection déposé — CONFORME."'));
  add(infoBox('Inspection reports are immutable once filed. UUID-timestamped and GPS-confirmed. Protects the inspector legally.'));
  add(sp());

  add(infoBox('Scenario 5 Complete: Youssef confirmed assignment, opened visit, filed complete passing inspection report with farm-level findings.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6 — CERTIFICATION BODY
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(6, 'Certification Body: Full Decision Workflow', 'Omar', 'certification-body'));
  add(sp());

  add(h2('Step 6.1 — Fatima Requests Certification'));
  add(httpBadge('POST', '/certifications/request'));
  add(codeBlock([
    '{ "batchId": "batch-uuid-001", "certificationType": "IGP" }',
  ]));
  add(codeBlock([
    '// Response:',
    '{ "id": "cert-uuid-001", "currentStatus": "SUBMITTED",',
    '  "requestedAt": "2025-11-13T09:00:00Z" }',
  ]));
  add(kafkaNote(['certification.requested']));
  add(notifNote('Omar receives email: "Nouvelle demande de certification."'));
  add(sp());

  add(h2('Step 6.2 — Start Document Review'));
  add(httpBadge('POST', '/certifications/{id}/start-review'));
  add(body('Status → DOCUMENT_REVIEW'));
  add(sp());

  add(h2('Step 6.3 — Schedule Inspection'));
  add(httpBadge('POST', '/certifications/{id}/schedule-inspection'));
  add(codeBlock([
    '{',
    '  "inspectorId": "youssef-user-uuid",',
    '  "scheduledDate": "2025-11-20",',
    '  "farmIds": ["farm-uuid-001"]',
    '}',
  ]));
  add(kafkaNote(['certification.inspection.scheduled']));
  add(notifNote('Youssef + Fatima receive SMS + email with date and address.'));
  add(sp());

  add(h2('Step 6.4 — Start Final Review'));
  add(httpBadge('POST', '/certifications/{id}/start-final-review'));
  add(body('Status → UNDER_REVIEW  (requires both inspection + lab to be complete)'));
  add(sp());

  add(h2('Step 6.5 — Grant Certification'));
  add(httpBadge('PATCH', '/certifications/{id}/grant'));
  add(codeBlock(['{ "validityDays": 365 }']));
  add(codeBlock([
    '// Response:',
    '{',
    '  "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0001",',
    '  "currentStatus": "GRANTED",',
    '  "validFrom": "2025-11-25",',
    '  "validUntil": "2026-11-25"',
    '}',
  ]));
  add(warnBox('Sequential number generated atomically via certification_seq table. No two certifications ever share a number.'));
  add(kafkaNote(['certification.decision.granted', 'certification.qrcode.generated']));
  add(notifNote('Fatima receives SMS + email with certification number and QR download link.'));
  add(sp());

  add(h2('Step 6.6 — Download Trilingual PDF Certificate'));
  add(httpBadge('GET', '/certifications/{id}/certificate.pdf'));
  add(body('Returns PDF with: certification number, cooperative details, batch info, lab test summary, validity dates, QR code, trilingual text (French · Arabic · Tifinagh).'));
  add(sp());

  add(h2('Step 6.7 — Download QR Code'));
  add(httpBadge('GET', '/qr-codes/{certId}/download?format=png'));
  add(body('Returns PNG or SVG (use ?format=svg). Print-ready for label and packaging.'));
  add(sp());

  add(h2('Step 6.8 — Deny a Certification (alternative)'));
  add(httpBadge('PATCH', '/certifications/{id}/deny'));
  add(codeBlock([
    '{',
    '  "reason": "Picrocrocine en dessous du seuil minimum IGP',
    '   (valeur: 62, seuil: 70). Rapport inspection manquant."',
    '}',
  ]));
  add(kafkaNote(['certification.decision.denied']));
  add(notifNote('Fatima receives SMS + email with denial reason and resubmission instructions.'));
  add(sp());

  add(h2('Step 6.9 — Revoke a Granted Certification'));
  add(httpBadge('PATCH', '/certifications/{id}/revoke'));
  add(codeBlock([
    '{',
    '  "reason": "Contrôle marché: échantillon ne correspond pas',
    '   aux paramètres certifiés. Fraude suspectée."',
    '}',
  ]));
  add(infoBox('QR code deactivated immediately (isActive: false). All future scans return valid: false.'));
  add(kafkaNote(['certification.revoked']));
  add(sp());

  add(infoBox('Scenario 6 Complete: Omar processed full lifecycle (submitted → grant), issued sequential certification number, generated QR-signed certificate, downloaded trilingual PDF.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7 — CUSTOMS AGENT
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(7, 'Customs Agent: Export Documentation', 'Leila', 'customs-agent'));
  add(sp());

  add(h2('Step 7.1 — Fatima Requests Export Document'));
  add(httpBadge('POST', '/export-documents'));
  add(codeBlock([
    '{',
    '  "certificationId": "cert-uuid-001",',
    '  "destinationCountry": "DE",',
    '  "hsCode": "09102000",',
    '  "quantityKg": 10.0,',
    '  "consigneeName": "Gewürzhaus GmbH",',
    '  "consigneeCountry": "DE"',
    '}',
  ]));
  add(kafkaNote(['export.document.requested']));
  add(notifNote('Leila receives email: "Nouvelle demande de document d\'export."'));
  add(sp());

  add(h2('Step 7.2 — Leila Validates Export Clearance'));
  add(httpBadge('POST', '/export-documents/{id}/validate'));
  add(codeBlock([
    '// Response:',
    '{',
    '  "status": "approved",',
    '  "validUntil": "2026-01-26",',
    '  "validatedAt": "2025-11-26T14:00:00Z"',
    '}',
  ]));
  add(kafkaNote(['export.document.validated']));
  add(notifNote('Fatima receives email: "Document d\'export approuvé — expédition autorisée vers l\'Allemagne."'));
  add(sp());

  add(h2('Step 7.3 — Download Export Certificate PDF'));
  add(httpBadge('GET', '/export-documents/{id}/certificate.pdf'));
  add(body('PDF includes: certification number, HS code (09102000 — Saffron), destination, consignee, quantity, validity, official stamp area.'));
  add(sp());

  add(h2('Step 7.4 — Export Clearances Report (CSV)'));
  add(httpBadge('GET', '/export-documents/clearances-report?from=2025-11-01&to=2025-11-30&destinationCountry=DE'));
  add(codeBlock([
    'certification_number,product_type,destination,quantity_kg,status,date',
    'TERROIR-IGP-DRAA_TAFILALET-2025-0001,SAFFRON,DE,10.00,approved,2025-11-26',
  ]));
  add(sp());

  add(infoBox('Scenario 7 Complete: Leila validated clearance for Germany, downloaded export PDF, generated monthly CSV clearances report.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 8 — CONSUMER (PUBLIC QR)
  // ══════════════════════════════════════════════════════════════════════════
  add(...scenarioBanner(8, 'Consumer: Public QR Verification', 'Yuki Tanaka', 'consumer (public — no auth)'));
  add(sp());

  add(h2('Step 8.1 — Scan QR Code'));
  add(httpBadge('GET', '/verify/{hmac-signature}'));
  add(body('No Authorization header required. Yuki scans the QR on a saffron jar in Paris. Her browser navigates to this URL.'));
  add(sp());

  add(h2('Step 8.2 — Default Response (French)'));
  add(codeBlock([
    '{',
    '  "valid": true,',
    '  "certification": {',
    '    "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0001",',
    '    "productTypeCode": "SAFFRON",',
    '    "cooperativeName": "Coopérative Safran Taliouine",',
    '    "certificationType": "IGP",',
    '    "validFrom": "2025-11-25",',
    '    "validUntil": "2026-11-25"',
    '  },',
    '  "qrCode": { "scansCount": 43, "issuedAt": "2025-11-25T11:00:00Z" },',
    '  "message": "Certification valide",',
    '  "lang": "fr", "rtl": false',
    '}',
  ]));
  add(sp());

  add(h2('Step 8.3 — Request Arabic or Tifinagh'));
  add(httpBadge('GET', '/verify/{hmac}?lang=ar'));
  add(codeBlock(['{ "valid": true, "message": "شهادة صحيحة", "lang": "ar", "rtl": true }']));
  add(httpBadge('GET', '/verify/{hmac}?lang=zgh'));
  add(codeBlock(['{ "valid": true, "message": "ⴰⵙⵖⵉⵡⵙ ⵉⵍⵉⵍⵍⵉ", "lang": "zgh", "rtl": false }']));
  add(sp());

  add(h2('Step 8.4 — Fake or Revoked QR'));
  add(httpBadge('GET', '/verify/fake-hmac-000000000000'));
  add(codeBlock(['// HTTP 404', '{ "valid": false, "message": "Certification introuvable ou non valide" }']));
  add(infoBox('QR verification p99 latency: < 200ms (Redis-cached). Fake QRs return 404 with no certification data.'));
  add(sp());

  add(infoBox('Scenario 8 Complete: Yuki verified saffron QR in 1.8 seconds from Paris — cooperative name, IGP certification number, validity date — in French, Arabic, or Tifinagh.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 9 — END-TO-END TABLE
  // ══════════════════════════════════════════════════════════════════════════
  add(h1('SCENARIO 9 — END-TO-END FULL CERTIFICATION JOURNEY'));
  add(body('All 9 personas, 12 workflow steps, chained in one demonstration.'));
  add(sp());

  add(dataTable([
    ['Step', 'Actor', 'Action', 'Result'],
    ['1', 'Khalid', 'PATCH /cooperatives/:id/verify', 'Cooperative → active'],
    ['2', 'Khalid', 'POST /labs/:id/accredit', 'Lab → isAccredited: true'],
    ['3', 'Fatima', 'POST /cooperatives/:id/farms', 'Farm registered with GPS'],
    ['4', 'Fatima', 'POST /cooperatives/:id/members', 'Hassan added'],
    ['5', 'Hassan', 'POST /harvests', '12.5 kg saffron, campaign 2025/2026'],
    ['6', 'Hassan', 'POST /batches', 'BATCH-SAFFRON-2025-001 → created'],
    ['7', 'Hassan', 'POST /batches/:id/processing-steps ×3', 'DRYING → SORTING → PACKAGING'],
    ['8', 'Fatima', 'POST /lab-tests', 'Lab test assigned to Dr. Amina'],
    ['9', 'Dr. Amina', 'POST /lab-tests/:id/results', 'All 5 ISO 3632 params pass → lab-passed'],
    ['10', 'Dr. Amina', 'POST /lab-tests/:id/report', 'PDF report uploaded'],
    ['11', 'Fatima', 'POST /certifications/request', 'Cert → SUBMITTED'],
    ['12', 'Omar', 'POST /certifications/:id/start-review', 'Cert → DOCUMENT_REVIEW'],
    ['13', 'Omar', 'POST /certifications/:id/schedule-inspection', 'Inspection created'],
    ['14', 'Youssef', 'POST /certifications/:id/start-inspection', 'Cert → INSPECTION_IN_PROGRESS'],
    ['15', 'Youssef', 'PATCH /inspections/:id/report', 'Report filed → INSPECTION_COMPLETE'],
    ['16', 'Omar', 'POST /certifications/:id/start-final-review', 'Cert → UNDER_REVIEW'],
    ['17', 'Omar', 'PATCH /certifications/:id/grant', 'TERROIR-IGP-DRAA_TAFILALET-2025-0001 GRANTED'],
    ['18', 'Fatima', 'GET /qr-codes/:certId/download', 'QR code PNG printed on label'],
    ['19', 'Fatima', 'POST /export-documents', 'Export doc → draft'],
    ['20', 'Leila', 'POST /export-documents/:id/validate', 'Export doc → approved'],
    ['21', 'Yuki', 'GET /verify/:hmac', 'Verified in < 2s from Paris ✅'],
  ], [600, 1200, 3600, 3600]));
  add(sp());
  add(infoBox('Total Kafka events: 17 across the full chain.  Total notifications: ~12 SMS+email to relevant actors at each state transition.'));
  add(pageBreak());

  // ══════════════════════════════════════════════════════════════════════════
  // QUICK REFERENCE TABLES
  // ══════════════════════════════════════════════════════════════════════════
  add(h1('QUICK REFERENCE'));
  add(sp());

  add(h2('Lab Test Parameters — Saffron (ISO 3632)'));
  add(dataTable([
    ['Parameter', 'Unit', 'Min', 'Max'],
    ['Crocin (E1% @ 440nm)', 'E1%', '190', '—'],
    ['Safranal (E1% @ 330nm)', 'E1%', '20', '50'],
    ['Picrocrocin (E1% @ 257nm)', 'E1%', '70', '—'],
    ['Moisture', '%', '—', '12.0'],
    ['Total ash', '%', '—', '8.0'],
  ], [3800, 1200, 1500, 2500]));
  add(sp());

  add(h2('Lab Test Parameters — Argan Oil (AOP)'));
  add(dataTable([
    ['Parameter', 'Unit', 'Min', 'Max'],
    ['Acidity (% oleic acid)', '%', '—', '4.0'],
    ['Peroxide value', 'meq O₂/kg', '—', '20.0'],
    ['Moisture', '%', '—', '0.2'],
    ['Oleic acid (C18:1)', '%', '43.0', '49.9'],
    ['Total tocopherols', 'mg/kg', '600', '900'],
  ], [3800, 1200, 1500, 2500]));
  add(sp());

  add(h2('Kafka Events Reference'));
  add(dataTable([
    ['Event', 'Fired by', 'Consumers'],
    ['cooperative.registration.verified', 'super-admin', 'Notification'],
    ['product.batch.created', 'cooperative-member', 'Notification'],
    ['lab.test.submitted', 'cooperative-admin', 'Notification'],
    ['lab.test.completed', 'lab-technician', 'Product module, Notification'],
    ['certification.requested', 'cooperative-admin', 'Notification'],
    ['certification.inspection.scheduled', 'certification-body', 'Notification'],
    ['certification.inspection.completed', 'inspector', 'Notification'],
    ['certification.decision.granted', 'certification-body', 'QrCode, Notification'],
    ['certification.decision.denied', 'certification-body', 'Notification'],
    ['certification.revoked', 'certification-body', 'QrCode, Notification'],
    ['certification.qrcode.generated', 'QrCode service', 'Notification'],
    ['export.document.validated', 'customs-agent', 'Notification'],
  ], [3600, 2400, 3000]));
  add(sp());

  add(h2('Certification State Machine'));
  add(codeBlock([
    'DRAFT → SUBMITTED → DOCUMENT_REVIEW',
    '         └→ INSPECTION_SCHEDULED → INSPECTION_IN_PROGRESS → INSPECTION_COMPLETE',
    '         └→ LAB_TESTING → LAB_RESULTS_RECEIVED',
    '         └→ UNDER_REVIEW',
    '              ├→ GRANTED → RENEWED',
    '              ├→ DENIED',
    '              └→ REVOKED',
  ]));
  add(sp());

  add(h2('Response Envelope'));
  add(codeBlock([
    '{',
    '  "success": true,',
    '  "data": { /* endpoint-specific payload */ },',
    '  "meta": { "page": 1, "limit": 20, "total": 100 }',
    '}',
  ]));
  add(sp());

  add(h2('Health Endpoints'));
  add(dataTable([
    ['Endpoint', 'Auth', 'Purpose', 'Failure response'],
    ['GET /health', 'None', 'Liveness — process alive?', '500 (container restart)'],
    ['GET /ready', 'None', 'Readiness — DB connected?', '503 (traffic gated)'],
    ['GET /metrics', 'IP-gated', 'Prometheus metrics', '403 from non-monitor IP'],
  ], [2000, 1200, 3200, 2600]));
  add(sp());

  // ── Footer ─────────────────────────────────────────────────────────────────
  add(divider());
  add(p([r('Terroir.ma  ·  User Manual v1.0  ·  April 2026  ·  Sprint 1 + 2 Complete', {
    size: 18, color: C.slate,
  })], { alignment: AlignmentType.CENTER }));
  add(p([r('104 endpoints  ·  9 roles  ·  12-step workflow  ·  18 Kafka events  ·  22 entity types', {
    size: 18, color: C.saffron,
  })], { alignment: AlignmentType.CENTER }));

  // ── Assemble document ──────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } },
      },
      headers: {
        default: new Header({
          children: [p([
            r('Terroir.ma  ·  User Manual & Test Scenarios  ·  April 2026', {
              size: 16, color: C.slate,
            }),
          ], {
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.saffron } },
            spacing: { after: 100 },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [p([
            r('terroir.ma  ·  Law 25-06 SDOQ  ·  Page ', { size: 16, color: C.slate }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.slate }),
          ], {
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.saffron } },
            spacing: { before: 60 },
          })],
        }),
      },
      children,
    }],
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buf);
  console.log(`✅  USER-MANUAL-TEST-SCENARIOS.docx  →  ${OUT}`);
}

build().catch((err) => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
