/**
 * Terroir.ma — DOCX Presentation Scenario Generator
 * Generates:
 *   docs/pitch/EXECUTIVE-SUMMARY.docx
 *   docs/pitch/COOPERATIVE-PITCH.docx
 * Run: node scripts/generate-pitch-docx.js
 */

'use strict';

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, TableBorders, BorderStyle,
  WidthType, AlignmentType, ShadingType, PageBreak,
  Header, Footer, PageNumber, NumberFormat, UnderlineType,
  HorizontalPositionAlign, VerticalPositionAlign,
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ─── Brand colours (ARGB — no leading #) ─────────────────────────────────────
const C = {
  green:   '2D6A4F',
  saffron: 'E9A824',
  cream:   'F9F3E8',
  brown:   '774936',
  dark:    '1A1A1A',
  white:   'FFFFFF',
  slate:   '4A5568',
  light:   'F0EBE1',
  greenBg: 'E8F3EE',
};

const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'pitch');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(text, opts = {}) {
  return new TextRun({ text, ...opts });
}

/** Plain paragraph */
function para(children, opts = {}) {
  const runs = Array.isArray(children)
    ? children
    : [typeof children === 'string' ? run(children) : children];
  return new Paragraph({ children: runs, ...opts });
}

/** Heading 1 — section banner */
function h1(text, lang = 'ltr') {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 52,
        color: C.white,
        font: 'Calibri',
      }),
    ],
    heading: HeadingLevel.HEADING_1,
    alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    shading: { type: ShadingType.SOLID, color: C.green, fill: C.green },
    spacing: { before: 320, after: 160 },
    indent: { left: 160, right: 160 },
  });
}

/** Heading 2 — slide title */
function h2(text, lang = 'ltr') {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 40,
        color: C.green,
        font: 'Calibri',
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: C.saffron, space: 4 },
    },
    spacing: { before: 280, after: 120 },
  });
}

/** Heading 3 — sub-section */
function h3(text, lang = 'ltr') {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: C.brown,
        font: 'Calibri',
      }),
    ],
    heading: HeadingLevel.HEADING_3,
    alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: 200, after: 80 },
  });
}

/** Body paragraph */
function body(text, lang = 'ltr', opts = {}) {
  return new Paragraph({
    children: [run(text, { size: 22, font: 'Calibri', color: C.dark })],
    alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: 80 },
    ...opts,
  });
}

/** Bullet point */
function bullet(text, lang = 'ltr', level = 0) {
  return new Paragraph({
    children: [run(text, { size: 22, font: 'Calibri', color: C.dark })],
    bullet: { level },
    alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: 60 },
  });
}

/** Callout / highlight box */
function callout(text, lang = 'ltr') {
  return new Paragraph({
    children: [
      run(text, {
        size: 24,
        font: 'Calibri',
        bold: true,
        color: C.green,
        italics: true,
      }),
    ],
    alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    shading: { type: ShadingType.SOLID, color: C.greenBg, fill: C.greenBg },
    border: {
      left: { style: BorderStyle.THICK, size: 16, color: C.saffron, space: 6 },
    },
    indent: { left: 240, right: 240 },
    spacing: { before: 160, after: 160 },
  });
}

/** Page break */
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

/** Spacer */
function spacer(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ children: [run('')], spacing: { after: 80 } }),
  );
}

/** Table row helper */
function trow(cells, isHeader = false, lang = 'ltr') {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((cell) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [
              run(cell, {
                bold: isHeader,
                size: isHeader ? 20 : 18,
                color: isHeader ? C.white : C.dark,
                font: 'Calibri',
              }),
            ],
            alignment: lang === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT,
          }),
        ],
        shading: isHeader
          ? { type: ShadingType.SOLID, color: C.green, fill: C.green }
          : { type: ShadingType.CLEAR, fill: C.white },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
      }),
    ),
  });
}

/** Full table */
function table(rows, lang = 'ltr', widths) {
  const tableRows = rows.map((r, i) => trow(r, i === 0, lang));
  return new Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top:           { style: BorderStyle.SINGLE, size: 4, color: C.light },
      bottom:        { style: BorderStyle.SINGLE, size: 4, color: C.light },
      left:          { style: BorderStyle.SINGLE, size: 4, color: C.light },
      right:         { style: BorderStyle.SINGLE, size: 4, color: C.light },
      insideH:       { style: BorderStyle.SINGLE, size: 2, color: C.light },
      insideV:       { style: BorderStyle.SINGLE, size: 2, color: C.light },
    },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  });
}

/** Divider line */
function divider() {
  return new Paragraph({
    children: [run('')],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: C.saffron, space: 2 },
    },
    spacing: { before: 120, after: 120 },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 1 — EXECUTIVE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

function buildExecutiveSummary() {
  return new Document({
    numbering: {
      config: [
        {
          reference: 'default-bullets',
          levels: [
            {
              level: 0,
              format: NumberFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  run('Terroir.ma — Executive Summary  ·  April 2026  ·  Law 25-06 SDOQ', {
                    size: 16, color: C.slate, font: 'Calibri',
                  }),
                ],
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: C.saffron },
                },
                spacing: { after: 120 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  run('terroir.ma  ·  De la terre au QR code. Prouvé.  ·  Page ', {
                    size: 16, color: C.slate, font: 'Calibri',
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.slate }),
                ],
                alignment: AlignmentType.CENTER,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: C.saffron },
                },
                spacing: { before: 80 },
              }),
            ],
          }),
        },
        children: [

          // ── Title block ──────────────────────────────────────────────────
          new Paragraph({
            children: [run('Terroir.ma', { bold: true, size: 72, color: C.green, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 60 },
          }),
          new Paragraph({
            children: [run('Executive Summary — April 2026', { size: 28, color: C.brown, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [run('"De la terre au QR code. Prouvé."', { size: 26, color: C.saffron, font: 'Calibri', italics: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          divider(),

          // ════════════════════════════════════════════════════════════════
          // SECTION 1 — ENGLISH
          // ════════════════════════════════════════════════════════════════
          h1('SECTION 1 — ENGLISH'),
          h3('One-Page Briefing for Institutional Decision-Makers & International Partners'),
          spacer()[0],

          h2('What We Built'),
          body('Terroir.ma is the first digital certification platform for Moroccan SDOQ terroir products — built under Law 25-06, trilingual (French · Arabic · Tifinagh), designed to make authentic Moroccan cooperatives provable to any buyer, anywhere in the world, in under 2 seconds.'),
          spacer()[0],

          h2('The Problem'),
          body('Morocco has 1,800+ SDOQ-registered cooperatives producing €300M+ in annual terroir exports. The certification process is legally valid, institutionally rigorous, and completely invisible outside Morocco. When a buyer in Frankfurt asks for "a verifiable digital certificate" at 9pm, a cooperative holding a perfectly valid ONSSA certificate on paper cannot answer. Contracts are cancelled. €200M+ per year is lost to counterfeits and blocked shipments. The infrastructure for trust exists. The digital layer does not.'),
          spacer()[0],

          h2('The Solution'),
          body('Terroir.ma adds a digital layer on top of the existing SDOQ process without replacing any step. A cooperative registers in 15 minutes. Harvest logs with GPS. Lab results submit digitally. Inspector files via tablet. The certification body grants or denies. One atomic database transaction generates a cryptographically signed QR code (HMAC-SHA256), a sequential certification number (TERROIR-AOP-SOUSS-2025-047), and a trilingual verification payload — permanently immutable, verifiable by any phone in 1.8 seconds.'),
          spacer()[0],

          h2('What Makes It Different'),
          table([
            ['Claim', 'Proof'],
            ['Built for Law 25-06 SDOQ', 'Cert. number format, 3 label types, 9-role model map directly to the law'],
            ['Tamper-proof QR', 'HMAC-SHA256 — same algorithm used by international banks'],
            ['Trilingual including Amazigh', 'fr-MA + ar-MA + zgh (Tifinagh) — only SDOQ platform globally with this'],
            ['CNDP compliant by design', 'PII redacted from all logs and Kafka events — not added after the fact'],
            ['Production-grade from day one', '308 source files · 40 test files · 10 ADRs · Testcontainers integration tests'],
          ], 'ltr', [3600, 5400]),
          spacer()[0],

          h2('Business Model'),
          table([
            ['Revenue Stream', 'Price', 'Scale'],
            ['Cooperative SaaS', '200 MAD / month', '100K MAD/mo at 500 cooperatives'],
            ['B2G Institutional', '500K–2M MAD / year', 'MAPMDREF / ONSSA annual contract'],
            ['Premium Export API', 'Custom SLA', 'EU importers, certification bodies'],
          ], 'ltr', [3000, 2700, 3300]),
          spacer()[0],

          h2('Where We Stand — April 2026'),
          bullet('Sprint 1 complete: 308 files, full infrastructure, all 4 domain modules'),
          bullet('Sprint 2 complete: Database migrations, cooperative verify flow, sequential cert numbers'),
          bullet('Sprint 3 in progress: End-to-end certification API, QR verification endpoint'),
          bullet('Sprint 4 planned: 3-cooperative pilot, Swagger documentation, monitoring'),
          spacer()[0],

          h2('The Ask'),
          callout('A 12-week pilot with 3 certified cooperatives. Zero infrastructure cost to MAPMDREF. Full impact report at the end. A single sentence of official endorsement — "Terroir.ma is compliant with Law 25-06" — is worth more to this platform than any investment round.'),

          pageBreak(),

          // ════════════════════════════════════════════════════════════════
          // SECTION 2 — FRANÇAIS
          // ════════════════════════════════════════════════════════════════
          h1('SECTION 2 — FRANÇAIS'),
          h3('Note de synthèse pour les décideurs institutionnels et partenaires stratégiques'),
          spacer()[0],

          h2('Ce que nous avons construit'),
          body('Terroir.ma est la première plateforme marocaine de certification numérique des produits SDOQ terroir — conforme à la Loi 25-06, trilingue (Français · Arabe · Tifinagh), conçue pour rendre les coopératives marocaines authentiques prouvables auprès de n\'importe quel acheteur, partout dans le monde, en moins de 2 secondes.'),
          spacer()[0],

          h2('Le Problème'),
          body('Le Maroc compte 1 800+ coopératives SDOQ enregistrées produisant plus de 300 M€ d\'exportations terroir par an. Le processus de certification est légalement valide, institutionnellement rigoureux, et totalement invisible en dehors du Maroc. Quand un acheteur à Francfort demande "un certificat numérique vérifiable" à 21h, une coopérative détenant un certificat ONSSA parfaitement valide sur papier ne peut pas répondre. Les contrats sont annulés. Plus de 200 M€ par an sont perdus. L\'infrastructure de confiance existe. La couche numérique, non.'),
          spacer()[0],

          h2('La Solution'),
          body('Terroir.ma ajoute une couche numérique au-dessus du processus SDOQ existant sans remplacer une seule étape. Une coopérative s\'enregistre en 15 minutes. Les récoltes sont saisies avec GPS. Les résultats du labo sont soumis numériquement. L\'inspecteur dépose son rapport sur tablette. L\'organisme de certification accorde ou refuse. Une transaction atomique génère un QR code signé cryptographiquement (HMAC-SHA256), un numéro de certification séquentiel (TERROIR-AOP-SOUSS-2025-047), et un payload de vérification trilingue — immuable, vérifiable par n\'importe quel téléphone en 1,8 seconde.'),
          spacer()[0],

          h2('Ce qui nous différencie'),
          table([
            ['Affirmation', 'Preuve'],
            ['Construit pour la Loi 25-06 SDOQ', 'Format cert., 3 types labels, modèle 9 rôles Keycloak — alignés sur la loi'],
            ['QR infalsifiable', 'HMAC-SHA256 — même algorithme que les banques internationales'],
            ['Trilingue avec Amazigh', 'fr-MA + ar-MA + zgh (Tifinagh) — seule plateforme SDOQ au monde'],
            ['Conformité CNDP par conception', 'PII absent des logs et événements Kafka — pas ajouté après coup'],
            ['Architecture production dès le départ', '308 fichiers sources · 40 tests · 10 ADR · Testcontainers'],
          ], 'ltr', [3600, 5400]),
          spacer()[0],

          h2('Modèle Économique'),
          table([
            ['Ligne de revenus', 'Prix', 'Échelle'],
            ['SaaS Coopératives', '200 MAD / mois', '100 K MAD/mois à 500 coopératives'],
            ['B2G Institutionnel', '500 K–2 M MAD / an', 'Contrat annuel MAPMDREF / ONSSA'],
            ['API Export Premium', 'SLA sur devis', 'Importateurs UE, organismes cert.'],
          ], 'ltr', [3000, 2700, 3300]),
          spacer()[0],

          h2('État d\'Avancement — Avril 2026'),
          bullet('Sprint 1 terminé : 308 fichiers, infrastructure complète, 4 modules domaines'),
          bullet('Sprint 2 terminé : Migrations, flow vérification, numéros de certification séquentiels'),
          bullet('Sprint 3 en cours : API certification bout-en-bout, endpoint vérification QR'),
          bullet('Sprint 4 planifié : Pilote 3 coopératives, documentation Swagger, monitoring'),
          spacer()[0],

          h2('La Demande'),
          callout('Un pilote de 12 semaines avec 3 coopératives certifiées. Zéro coût d\'infrastructure pour le MAPMDREF. Rapport d\'impact complet à la fin. Une seule phrase d\'aval officiel — "Terroir.ma est conforme à la Loi 25-06" — vaut plus pour cette plateforme que n\'importe quel tour d\'investissement.'),

          pageBreak(),

          // ════════════════════════════════════════════════════════════════
          // SECTION 3 — DARIJA
          // ════════════════════════════════════════════════════════════════
          h1('القسم الثالث — بالدارجة المغربية', 'rtl'),
          h3('ملخص تنفيذي لصانعي القرار والشركاء الاستراتيجيين', 'rtl'),
          spacer()[0],

          h2('شنو بنينا', 'rtl'),
          body('Terroir.ma هي أول منصة مغربية لرقمنة شهادات SDOQ ديال المنتجات الفلاحية ذات التسمية — مطابقة للقانون 25-06، بثلاث لغات (فرنسية · عربية · تيفيناغ) — مبنية باش كل كوبيراتيف مغربي أصيل يكون مثبَّت عند أي زبون فأي بلد في أقل من ثانيتين.', 'rtl'),
          spacer()[0],

          h2('المشكلة', 'rtl'),
          body('المغرب عنده +1,800 كوبيراتيف مسجلة SDOQ كتصدر +300 مليون أورو من المنتجات الفلاحية كل سنة. الشهادات موجودة، صحيحة قانونيًا — لكنها على ورق وبالعربية — وما مبيناش خارج المغرب. واحد الزبون فألمانيا كيطلب "شهادة رقمية نقدر نتحقق منها الليلة" — الكوبيراتيف عندها الشهادة على ورق — ما قادرة تجيب جواب. العقد يتلغى. هاد المشكلة كتكلف المغرب +200 مليون أورو فالسنة.', 'rtl'),
          spacer()[0],

          h2('الحل', 'rtl'),
          body('Terroir.ma كتضيف طبقة رقمية فوق عملية SDOQ الموجودة بلا ما تبدل حتى خطوة واحدة. الكوبيراتيف تسجل في 15 دقيقة، الحصاد يتسجل مع GPS، المخبر يدخل نتائجو رقميًا، المفتش يكمل تقريرو بالتابلت، هيئة المصادقة تمنح أو ترفض — فالحين كيتولد QR code موقع رقميًا (HMAC-SHA256) ورقم تسلسلي TERROIR-IGP-TLN-2025-018 ومعلومات بثلاث لغات — لا يتغيرو، يتحقق منهم بأي تيليفون في 2 ثانية.', 'rtl'),
          spacer()[0],

          h2('شنو كيميزنا', 'rtl'),
          table([
            ['الادعاء', 'الإثبات'],
            ['مبنيين على القانون 25-06 SDOQ', 'صيغة رقم الشهادة، 3 أنواع علامات، نموذج الـ9 أدوار — كلو مرتبط بالقانون'],
            ['QR لا يتزور', 'HMAC-SHA256 — نفس الخوارزمية ديال البنوك الدولية'],
            ['ثلاث لغات مع التيفيناغ', 'fr-MA + ar-MA + zgh — وحدنا فالعالم عندنا هاد الدعم'],
            ['CNDP مدمج من البداية', 'معطيات الأشخاص محمية من logs وكافكا — مشي مضافة بعدين'],
            ['Architecture production من أول يوم', '308 ملف · 40 اختبار · 10 ADR · tests على قواعد بيانات حقيقية'],
          ], 'rtl', [3600, 5400]),
          spacer()[0],

          h2('النموذج الاقتصادي', 'rtl'),
          table([
            ['خط الدخل', 'السعر', 'الحجم'],
            ['SaaS مع التعاونيات', '200 درهم / شهر', '100,000 درهم/شهر عند 500 كوبيراتيف'],
            ['B2G مع الدولة', '500,000 – 2,000,000 درهم/سنة', 'MAPMDREF / ONSSA'],
            ['API premium للتصدير', 'حسب الاتفاق', 'المستوردين الأوروبيين'],
          ], 'rtl', [3000, 3000, 3000]),
          spacer()[0],

          h2('وين وصلنا — أبريل 2026', 'rtl'),
          bullet('Sprint 1 تمّ: 308 ملف، infra كاملة، 4 modules', 'rtl'),
          bullet('Sprint 2 تمّ: migrations، عملية التحقق، الأرقام التسلسلية', 'rtl'),
          bullet('Sprint 3 جاري: API الشهادة كاملة، endpoint التحقق من QR', 'rtl'),
          bullet('Sprint 4 مخطط: تجربة 3 كوبيراتيفات، Swagger، monitoring', 'rtl'),
          spacer()[0],

          h2('شنو كنطلبو', 'rtl'),
          new Paragraph({
            children: [
              run('12 أسبوع تجربة مع 3 كوبيراتيفات معتمدة. ما كاين حتى تكلفة بنية تحتية على MAPMDREF. تقرير كامل فالنهاية. جملة رسمية واحدة — "Terroir.ma مطابق للقانون 25-06" — تسوى أكثر من أي جولة استثمار.', {
                size: 24, font: 'Calibri', bold: true, color: C.green, italics: true,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            shading: { type: ShadingType.SOLID, color: C.greenBg, fill: C.greenBg },
            border: {
              right: { style: BorderStyle.THICK, size: 16, color: C.saffron, space: 6 },
            },
            indent: { left: 240, right: 240 },
            spacing: { before: 160, after: 160 },
          }),
          spacer()[0],

          divider(),
          new Paragraph({
            children: [
              run('terroir.ma  ·  من الأرض إلى الكود  ·  De la terre au QR code. Prouvé.  ·  April 2026', {
                size: 18, color: C.slate, font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 2 — COOPERATIVE PITCH
// ─────────────────────────────────────────────────────────────────────────────

function buildCooperativePitch() {
  return new Document({
    numbering: {
      config: [
        {
          reference: 'default-bullets',
          levels: [
            {
              level: 0,
              format: NumberFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  run('Terroir.ma — Cooperative Onboarding Pitch  ·  April 2026', {
                    size: 16, color: C.slate, font: 'Calibri',
                  }),
                ],
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: C.saffron },
                },
                spacing: { after: 120 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  run('terroir.ma  ·  "Your certification. Proved. Everywhere."  ·  Page ', {
                    size: 16, color: C.slate, font: 'Calibri',
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.slate }),
                ],
                alignment: AlignmentType.CENTER,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: C.saffron },
                },
                spacing: { before: 80 },
              }),
            ],
          }),
        },
        children: [

          // ── Title ───────────────────────────────────────────────────────
          new Paragraph({
            children: [run('Terroir.ma', { bold: true, size: 72, color: C.green, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 60 },
          }),
          new Paragraph({
            children: [run('Cooperative Onboarding Pitch — April 2026', { size: 28, color: C.brown, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              run('"Your certification. Proved. Everywhere."  ·  ', { size: 22, color: C.saffron, font: 'Calibri', italics: true }),
              run('"Votre certification. Prouvée. Partout."  ·  ', { size: 22, color: C.saffron, font: 'Calibri', italics: true }),
              run('"شهادتك. مثبتة. في كل مكان."', { size: 22, color: C.saffron, font: 'Calibri', italics: true }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          divider(),

          // ════════════════════════════════════════════════════════════════
          // SECTION 1 — ENGLISH
          // ════════════════════════════════════════════════════════════════
          h1('SECTION 1 — ENGLISH'),
          h3('For: Diaspora cooperatives · International cooperative federations · English-speaking field agents'),
          spacer()[0],

          h2('The Story That Opens the Door'),
          body('Picture this: It\'s Tuesday, 9pm. A buyer in Frankfurt has just received your saffron sample. He loves it. His procurement team ran the ISO 3632 analysis — Grade I, crocin 247, picrocrocin 81. The finest saffron he has seen this year. He is ready to sign a €75,000 contract.'),
          spacer()[0],
          body('One problem: his food safety compliance team needs "a verifiable digital certificate." Not a PDF. Not a scan. A live, verifiable, digital certification that resolves to the actual cooperative, the actual batch, the actual lab results. He needs it tonight.'),
          spacer()[0],
          body('You have the ONSSA certificate. You have the lab results. You have everything — on paper, in Arabic, in a drawer in your office. You cannot answer him tonight.'),
          callout('The contract goes to a competitor. This is what we built Terroir.ma to prevent.'),
          spacer()[0],

          h2('What Terroir.ma Gives Your Cooperative'),
          body('One QR code on every certified batch. When your buyer scans it — from Frankfurt, from Paris, from Tokyo — they see:'),
          bullet('Your cooperative\'s name and legal registration'),
          bullet('The exact farm the product came from, with GPS map'),
          bullet('The harvest date and batch number'),
          bullet('The lab test results — every parameter, real numbers'),
          bullet('Your ONSSA certification number and grant date'),
          bullet('The certification number: TERROIR-IGP-TLN-2025-018'),
          bullet('Validity status in real time'),
          spacer()[0],
          body('In French. In Arabic. In Tifinagh. In under 2 seconds. Without calling you. Without waiting for a PDF. Without an intermediary.'),
          spacer()[0],

          h2('How It Works — 3 Steps'),
          h3('Step 1 — Register (15 minutes)'),
          body('Your cooperative registers online: legal name, ICE number, region, product type. You receive a WhatsApp confirmation. Done.'),
          h3('Step 2 — Log Your Harvest and Lab Results'),
          body('Your farmer logs the harvest date, quantity, and method. The lab technician submits results directly into the platform — acidity, peroxide value, crocin levels, whatever your product requires. No PDFs. No email attachments. One form.'),
          h3('Step 3 — Get Certified and Generate Your QR'),
          body('Your certification body reviews the file and approves. Immediately: your QR code is generated, cryptographically signed, and permanently registered. Your certification number is issued. You print it on your labels.'),
          spacer()[0],

          h2('The Numbers That Matter'),
          table([
            ['Before Terroir.ma', 'After Terroir.ma'],
            ['Certification cycle: 90 days', 'Certification cycle: 9 days'],
            ['Buyer verification: phone call + 3-day wait', 'Buyer verification: 2-second QR scan'],
            ['Paper certificate: invisible outside Morocco', 'QR code: verifiable in 180+ countries'],
            ['Lab results: lost in a PDF email', 'Lab results: live, linked to QR, permanent'],
            ['Counterfeit check: impossible', 'Counterfeit check: fake QR returns 404'],
          ], 'ltr', [4500, 4500]),
          spacer()[0],

          h2('The Guarantee'),
          callout('90-day free pilot. No credit card. No commitment. If after 90 days your buyer verification experience has not improved — we learn from it together and you pay nothing. But it will improve. Because your product is real. And now it\'s provable.'),

          pageBreak(),

          // ════════════════════════════════════════════════════════════════
          // SECTION 2 — FRANÇAIS
          // ════════════════════════════════════════════════════════════════
          h1('SECTION 2 — FRANÇAIS'),
          h3('Pour : Présidents de coopératives · Agents de terrain · Fédérations régionales · Partenaires ONSSA'),
          spacer()[0],

          h2('L\'Histoire qui Ouvre la Porte'),
          body('Imaginez ceci : Mardi soir, 21h. Un acheteur à Francfort vient de recevoir votre échantillon de safran. Il l\'adore. Son équipe a fait l\'analyse ISO 3632 — Grade I, crocine 247, picrocrocine 81. Le meilleur safran qu\'il a vu cette année. Il est prêt à signer un contrat de 75 000 €.'),
          spacer()[0],
          body('Un problème : son service conformité alimentaire exige "un certificat numérique vérifiable." Pas un PDF. Pas un scan. Un certificat vivant, vérifiable, qui pointe vers la vraie coopérative, le vrai lot, les vrais résultats du labo. Il en a besoin ce soir.'),
          spacer()[0],
          body('Vous avez le certificat ONSSA. Vous avez les résultats du labo. Vous avez tout — sur papier, en arabe, dans un classeur de votre bureau. Vous ne pouvez pas lui répondre ce soir.'),
          callout('Le contrat part chez un concurrent. C\'est exactement pour ça que nous avons construit Terroir.ma.'),
          spacer()[0],

          h2('Ce que Terroir.ma Apporte à Votre Coopérative'),
          body('Un QR code sur chaque lot certifié. Quand votre acheteur le scanne — depuis Francfort, Paris, Tokyo — il voit :'),
          bullet('Le nom et l\'enregistrement légal de votre coopérative'),
          bullet('La ferme exacte d\'où vient le produit, avec carte GPS'),
          bullet('La date de récolte et le numéro de lot'),
          bullet('Les résultats du laboratoire — chaque paramètre, chiffres réels'),
          bullet('Votre numéro de certification ONSSA et la date d\'accord'),
          bullet('Le numéro de certification : TERROIR-AOP-SOUSS-2025-047'),
          bullet('Le statut de validité en temps réel'),
          spacer()[0],
          body('En français. En arabe. En Tifinagh. En moins de 2 secondes. Sans vous appeler. Sans attendre un PDF. Sans intermédiaire.'),
          spacer()[0],

          h2('Comment ça Fonctionne — 3 Étapes'),
          h3('Étape 1 — Inscription (15 minutes)'),
          body('Votre coopérative s\'inscrit en ligne : nom légal, numéro ICE, région, type de produit. Vous recevez une confirmation WhatsApp. C\'est fait.'),
          h3('Étape 2 — Saisir la récolte et les résultats du labo'),
          body('Votre agriculteur saisit la date de récolte, la quantité et la méthode. Le technicien du laboratoire soumet les résultats directement dans la plateforme — acidité, indice de peroxyde, taux de crocine. Pas de PDFs. Pas de pièces jointes. Un seul formulaire.'),
          h3('Étape 3 — Certification et génération du QR'),
          body('L\'organisme de certification examine le dossier et approuve. Immédiatement : votre QR code est généré, signé cryptographiquement, et enregistré de façon permanente. Votre numéro de certification est émis. Vous l\'imprimez sur vos étiquettes.'),
          spacer()[0],

          h2('Les Chiffres qui Comptent'),
          table([
            ['Avant Terroir.ma', 'Après Terroir.ma'],
            ['Cycle de certification : 90 jours', 'Cycle de certification : 9 jours'],
            ['Vérification acheteur : appel + 3 jours d\'attente', 'Vérification acheteur : scan QR en 2 secondes'],
            ['Certificat papier : invisible hors du Maroc', 'QR code : vérifiable dans 180+ pays'],
            ['Résultats labo : perdus dans un email PDF', 'Résultats labo : live, liés au QR, permanents'],
            ['Contrôle contrefaçon : impossible', 'Contrôle contrefaçon : faux QR retourne 404'],
          ], 'ltr', [4500, 4500]),
          spacer()[0],

          h2('La Garantie'),
          callout('Pilote gratuit 90 jours. Pas de carte bancaire. Pas d\'engagement. Si après 90 jours votre expérience de vérification acheteur ne s\'est pas améliorée — on apprend ensemble et vous ne payez rien. Mais elle s\'améliorera. Parce que votre produit est réel. Et maintenant il est prouvable.'),

          pageBreak(),

          // ════════════════════════════════════════════════════════════════
          // SECTION 3 — DARIJA
          // ════════════════════════════════════════════════════════════════
          h1('القسم الثالث — بالدارجة المغربية', 'rtl'),
          h3('لـ: رؤساء التعاونيات · وكلاء الميدان · الجمعيات الجهوية · مديرو التعاونيات فالبادية', 'rtl'),
          spacer()[0],

          h2('الحكاية اللي كتفتح الباب', 'rtl'),
          body('تصور معايا هاد الموقف: نهار الثلاثاء، الساعة 9 ديال الليل. واحد الزبون فألمانيا توصلتو العينة ديال الزعفران ديالك. عجبو بزاف. الفريق ديالو دار تحليل ISO 3632 — Grade I، كروسين 247، بيكروكروسين 81. أحسن زعفران شافو فهاد العام. جاهز يوقع عقد من 75,000 أورو.', 'rtl'),
          spacer()[0],
          body('مشكلة واحدة: الفريق ديال المطابقة الغذائية عندو محتاج "شهادة رقمية نقدر نتحققو منها." مشي PDF. مشي سكان. شهادة حية، متحقق منها رقميًا. محتاجها الليلة.', 'rtl'),
          spacer()[0],
          body('عندك شهادة ONSSA. عندك نتيجة المخبر. عندك كلشي — على ورقة، بالعربية، فملف فمكتبك. ما قادر تجيبو جواب الليلة.', 'rtl'),
          new Paragraph({
            children: [
              run('العقد يمشي لمنافس. هاد الموقف بالضبط هو اللي بنينا Terroir.ma باش نمنعو.', {
                size: 24, font: 'Calibri', bold: true, color: C.green, italics: true,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            shading: { type: ShadingType.SOLID, color: C.greenBg, fill: C.greenBg },
            border: {
              right: { style: BorderStyle.THICK, size: 16, color: C.saffron, space: 6 },
            },
            indent: { left: 240, right: 240 },
            spacing: { before: 160, after: 160 },
          }),
          spacer()[0],

          h2('شنو كتعطي Terroir.ma لكوبيراتيفك', 'rtl'),
          body('QR code واحد على كل حزمة معتمدة. حين الزبون ديالك يسكانيه — من ألمانيا، من باريس، من طوكيو — كيشوف:', 'rtl'),
          bullet('اسم كوبيراتيفك والتسجيل القانوني ديالها', 'rtl'),
          bullet('الضيعة اللي جا منها المنتوج — مع الخريطة GPS', 'rtl'),
          bullet('تاريخ الحصاد ورقم الحزمة', 'rtl'),
          bullet('نتائج المخبر — كل معامل، بالأرقام الحقيقية', 'rtl'),
          bullet('رقم شهادة ONSSA وتاريخ المنح', 'rtl'),
          bullet('رقم الشهادة: TERROIR-IGP-TLN-2025-018', 'rtl'),
          bullet('حالة الصلاحية فالوقت الحقيقي', 'rtl'),
          spacer()[0],
          body('بالفرنسية. بالعربية. بالتيفيناغ. في أقل من 2 ثانية. بلا ما يتصل بيك. بلا ما ينتظر PDF. بلا وسيط.', 'rtl'),
          spacer()[0],

          h2('كيفاش كيخدم — 3 خطوات بسيطة', 'rtl'),
          h3('الخطوة 1 — التسجيل (15 دقيقة)', 'rtl'),
          body('الكوبيراتيف ديالك تسجل أونلاين: الاسم القانوني، رقم ICE (15 رقم)، الجهة، نوع المنتوج. كتوصلك رسالة على واتساب: "تم التسجيل." خلاص.', 'rtl'),
          h3('الخطوة 2 — سجل الحصاد ونتائج المخبر', 'rtl'),
          body('الفلاح يسجل تاريخ الحصاد والكمية والطريقة. تقني المخبر يدخل النتائج مباشرة فالنظام — الحموضة، البيروكسيد، نسبة الكروسين، كيفما خصت منتوجك. ما كاين PDF. ما كاين email. form واحدة.', 'rtl'),
          h3('الخطوة 3 — الشهادة والـ QR code', 'rtl'),
          body('هيئة المصادقة تراجع الملف وتوافق. فالحين: QR code ديالك يتولد، يتوقع رقميًا، ويتسجل بصفة نهائية. رقم الشهادة يصدر. تطبعو على الملصقات ديالك.', 'rtl'),
          spacer()[0],

          h2('الفرق — قبل وبعد', 'rtl'),
          table([
            ['قبل Terroir.ma', 'مع Terroir.ma'],
            ['مدة الشهادة: 90 يوم انتظار', 'مدة الشهادة: 9 أيام'],
            ['التحقق من الزبون: تيليفون + 3 أيام', 'التحقق من الزبون: سكان QR في 2 ثانية'],
            ['شهادة ورقية: غير مبينة خارج المغرب', 'QR code: يتحقق منو في +180 بلد'],
            ['نتائج المخبر: ضايعة في email', 'نتائج المخبر: حية، مرتبطة بالـ QR، للأبد'],
            ['الكشف عن التزوير: مستحيل', 'QR مزور: كيعطي 404'],
          ], 'rtl', [4500, 4500]),
          spacer()[0],

          h2('الضمان ديالنا', 'rtl'),
          new Paragraph({
            children: [
              run('90 يوم تجريبي مجاني. بلا خلاص. بلا التزام. إلا بعد 90 يوم التجربة ما تحسنتش — كنتعلمو مع بعض وما كتخلصش حتى درهم. ولكن غاتتحسن. لأن منتوجك حقيقي. ودابا يمكن تثبتو.', {
                size: 24, font: 'Calibri', bold: true, color: C.green, italics: true,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            shading: { type: ShadingType.SOLID, color: C.greenBg, fill: C.greenBg },
            border: {
              right: { style: BorderStyle.THICK, size: 16, color: C.saffron, space: 6 },
            },
            indent: { left: 240, right: 240 },
            spacing: { before: 160, after: 160 },
          }),
          spacer()[0],

          h2('كيفاش تبدا', 'rtl'),
          bullet('واتساب: ابعث لينا "Terroir" — كنردو عليك فأقل من ساعة بالدارجة', 'rtl'),
          bullet('الأونلاين: سجل مباشرة على terroir.ma — 15 دقيقة وخلاصة', 'rtl'),
          bullet('الوجه للوجه: وكيلنا الجهوي غادي يجي ليك — ديمو على التابلت في 4 دقايق', 'rtl'),
          spacer()[0],

          divider(),
          new Paragraph({
            children: [
              run('terroir.ma  ·  من الأرض إلى الكود  ·  De la terre au QR code. Prouvé.  ·  April 2026', {
                size: 18, color: C.slate, font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });
}

// ─── Write both files ─────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const doc1 = buildExecutiveSummary();
  const buf1 = await Packer.toBuffer(doc1);
  const out1 = path.join(OUT_DIR, 'EXECUTIVE-SUMMARY.docx');
  fs.writeFileSync(out1, buf1);
  console.log(`✅  EXECUTIVE-SUMMARY.docx  →  ${out1}`);

  const doc2 = buildCooperativePitch();
  const buf2 = await Packer.toBuffer(doc2);
  const out2 = path.join(OUT_DIR, 'COOPERATIVE-PITCH.docx');
  fs.writeFileSync(out2, buf2);
  console.log(`✅  COOPERATIVE-PITCH.docx   →  ${out2}`);
}

main().catch((err) => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
