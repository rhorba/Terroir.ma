/**
 * Terroir.ma — PPTX Pitch Deck Generator
 * Generates docs/pitch/PITCH-DECK.pptx
 * Run: node scripts/generate-pitch-pptx.js
 */

'use strict';

const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

// ─── Brand ───────────────────────────────────────────────────────────────────
const C = {
  green:   '2D6A4F',
  saffron: 'E9A824',
  cream:   'F9F3E8',
  brown:   '774936',
  dark:    '1A1A1A',
  white:   'FFFFFF',
  slate:   '4A5568',
  light:   'F0EBE1',
};

const FONT_TITLE  = 'Calibri';
const FONT_BODY   = 'Calibri';
const OUT_DIR     = path.resolve(__dirname, '..', 'docs', 'pitch');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bg(slide, color) {
  slide.background = { color };
}

function addFullRect(slide, color, x = 0, y = 0, w = '100%', h = '100%') {
  slide.addShape(slide.pptx ? slide.pptx.ShapeType.rect : 'rect', {
    x, y, w, h, fill: { color }, line: { color, width: 0 },
  });
}

/** Accent bar on the left side */
function accentBar(slide, color = C.saffron) {
  slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: '100%', fill: { color }, line: { color, width: 0 } });
}

/** Section divider slide */
function sectionSlide(pptx, label, subtitle, lang = 'ltr') {
  const slide = pptx.addSlide();
  bg(slide, C.green);
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.green }, line: { color: C.green, width: 0 } });
  slide.addShape('rect', { x: 0, y: 2.6, w: '100%', h: 0.06, fill: { color: C.saffron }, line: { color: C.saffron, width: 0 } });
  slide.addText(label, {
    x: 0.4, y: 1.0, w: 9.2, h: 1.2,
    fontSize: 44, bold: true, color: C.white, fontFace: FONT_TITLE,
    align: lang === 'rtl' ? 'right' : 'left',
  });
  slide.addText(subtitle, {
    x: 0.4, y: 2.8, w: 9.2, h: 0.8,
    fontSize: 22, color: C.saffron, fontFace: FONT_BODY,
    align: lang === 'rtl' ? 'right' : 'left',
  });
  slide.addText('terroir.ma', {
    x: 0.4, y: 6.8, w: 9.2, h: 0.5,
    fontSize: 14, color: C.cream, fontFace: FONT_BODY,
    align: lang === 'rtl' ? 'right' : 'left',
  });
  return slide;
}

/** Title slide */
function titleSlide(pptx) {
  const slide = pptx.addSlide();
  bg(slide, C.dark);
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 3.8, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  slide.addShape('rect', { x: 0, y: 3.8, w: '100%', h: 0.08, fill: { color: C.saffron }, line: { color: C.saffron, width: 0 } });

  slide.addText('Terroir.ma', {
    x: 0.5, y: 0.5, w: 9.0, h: 1.4,
    fontSize: 60, bold: true, color: C.white, fontFace: FONT_TITLE, align: 'center',
  });
  slide.addText('The First Digital Certification Platform for Moroccan SDOQ Products', {
    x: 0.5, y: 1.9, w: 9.0, h: 0.8,
    fontSize: 20, color: C.cream, fontFace: FONT_BODY, align: 'center',
  });
  slide.addText('La première plateforme marocaine de certification SDOQ numérique', {
    x: 0.5, y: 2.6, w: 9.0, h: 0.6,
    fontSize: 16, color: C.saffron, fontFace: FONT_BODY, align: 'center', italic: true,
  });

  slide.addText('"De la terre au QR code. Prouvé."', {
    x: 0.5, y: 4.2, w: 9.0, h: 0.7,
    fontSize: 24, bold: true, color: C.saffron, fontFace: FONT_BODY, align: 'center',
  });
  slide.addText('"From soil to code. Proved."', {
    x: 0.5, y: 4.85, w: 9.0, h: 0.5,
    fontSize: 18, color: C.cream, fontFace: FONT_BODY, align: 'center',
  });
  slide.addText('"من الأرض إلى الكود. مثبت."', {
    x: 0.5, y: 5.35, w: 9.0, h: 0.5,
    fontSize: 18, color: C.cream, fontFace: FONT_BODY, align: 'center',
  });

  slide.addText('Law 25-06 SDOQ  ·  fr · ar · ⵜⴼⵉⵏⴰⵖ  ·  HMAC-SHA256  ·  < 2 seconds  ·  April 2026', {
    x: 0.5, y: 6.6, w: 9.0, h: 0.5,
    fontSize: 12, color: C.slate, fontFace: FONT_BODY, align: 'center',
  });
  return slide;
}

/** Standard content slide */
function contentSlide(pptx, title, bullets, opts = {}) {
  const { lang = 'ltr', titleColor = C.green, bgColor = C.white } = opts;
  const slide = pptx.addSlide();
  bg(slide, bgColor);
  accentBar(slide, C.saffron);
  slide.addShape('rect', { x: 0.12, y: 0, w: 9.88, h: 1.1, fill: { color: bgColor }, line: { color: bgColor, width: 0 } });
  slide.addShape('rect', { x: 0.12, y: 1.0, w: 9.88, h: 0.04, fill: { color: C.saffron }, line: { color: C.saffron, width: 0 } });

  slide.addText(title, {
    x: 0.3, y: 0.12, w: 9.4, h: 0.85,
    fontSize: 28, bold: true, color: titleColor, fontFace: FONT_TITLE,
    align: lang === 'rtl' ? 'right' : 'left',
  });

  const bulletObjs = bullets.map((b) => {
    if (typeof b === 'string') {
      return { text: b, options: { bullet: { indent: 10 }, fontSize: 18, color: C.dark, paraSpaceAfter: 6, align: lang === 'rtl' ? 'right' : 'left' } };
    }
    return b;
  });

  slide.addText(bulletObjs, {
    x: 0.3, y: 1.15, w: 9.4, h: 5.5,
    fontFace: FONT_BODY, valign: 'top',
  });

  slide.addText('terroir.ma', {
    x: 8.8, y: 7.0, w: 1.2, h: 0.3,
    fontSize: 10, color: C.saffron, fontFace: FONT_BODY, align: 'right',
  });
  return slide;
}

/** Two-column table slide */
function tableSlide(pptx, title, rows, opts = {}) {
  const { lang = 'ltr', colWidths = [3.5, 5.5] } = opts;
  const slide = pptx.addSlide();
  bg(slide, C.white);
  accentBar(slide, C.saffron);
  slide.addShape('rect', { x: 0.12, y: 1.0, w: 9.88, h: 0.04, fill: { color: C.saffron }, line: { color: C.saffron, width: 0 } });
  slide.addText(title, {
    x: 0.3, y: 0.12, w: 9.4, h: 0.85,
    fontSize: 28, bold: true, color: C.green, fontFace: FONT_TITLE,
    align: lang === 'rtl' ? 'right' : 'left',
  });

  const tableData = rows.map((r, i) => {
    const isHeader = i === 0;
    return r.map((cell) => ({
      text: cell,
      options: {
        bold: isHeader,
        fontSize: isHeader ? 14 : 13,
        color: isHeader ? C.white : C.dark,
        fill: { color: isHeader ? C.green : (i % 2 === 0 ? C.light : C.white) },
        align: lang === 'rtl' ? 'right' : 'left',
        valign: 'middle',
      },
    }));
  });

  slide.addTable(tableData, {
    x: 0.3, y: 1.15, w: 9.4,
    colW: colWidths,
    border: { pt: 0.5, color: C.light },
    rowH: 0.45,
    fontFace: FONT_BODY,
  });

  slide.addText('terroir.ma', {
    x: 8.8, y: 7.0, w: 1.2, h: 0.3,
    fontSize: 10, color: C.saffron, fontFace: FONT_BODY, align: 'right',
  });
  return slide;
}

/** Quote / closing slide */
function closingSlide(pptx, quote, tagline, lang = 'ltr') {
  const slide = pptx.addSlide();
  bg(slide, C.cream);
  slide.addShape('rect', { x: 0, y: 0, w: 0.08, h: '100%', fill: { color: C.green }, line: { color: C.green, width: 0 } });
  slide.addShape('rect', { x: 9.92, y: 0, w: 0.08, h: '100%', fill: { color: C.green }, line: { color: C.green, width: 0 } });
  slide.addText('"', {
    x: 0.5, y: 0.4, w: 1.0, h: 1.2,
    fontSize: 96, color: C.saffron, fontFace: FONT_TITLE, bold: true,
  });
  slide.addText(quote, {
    x: 0.5, y: 1.0, w: 9.0, h: 4.5,
    fontSize: 20, color: C.dark, fontFace: FONT_BODY,
    align: lang === 'rtl' ? 'right' : 'left',
    lineSpacingMultiple: 1.4,
    italic: true,
  });
  slide.addShape('rect', { x: 0.5, y: 5.7, w: 9.0, h: 0.04, fill: { color: C.saffron }, line: { color: C.saffron, width: 0 } });
  slide.addText(tagline, {
    x: 0.5, y: 5.85, w: 9.0, h: 0.6,
    fontSize: 18, bold: true, color: C.green, fontFace: FONT_TITLE,
    align: lang === 'rtl' ? 'right' : 'left',
  });
  slide.addText('terroir.ma  ·  April 2026  ·  Sprint 1 + 2 Complete  ·  204 Story Points MVP', {
    x: 0.5, y: 6.7, w: 9.0, h: 0.4,
    fontSize: 11, color: C.slate, fontFace: FONT_BODY, align: 'center',
  });
  return slide;
}

// ─── Build ────────────────────────────────────────────────────────────────────

const pptx = new PptxGenJS();
pptx.layout  = 'LAYOUT_WIDE';
pptx.subject = 'Terroir.ma Investor Pitch Deck';
pptx.author  = 'Terroir.ma';
pptx.title   = 'Terroir.ma — Pitch Deck 2026';
pptx.company = 'Terroir.ma';

// ── Cover ──────────────────────────────────────────────────────────────────
titleSlide(pptx);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — ENGLISH
// ══════════════════════════════════════════════════════════════════════════════
sectionSlide(pptx, 'SECTION 1', 'English — International Investors · EU Buyers · Tech Partners');

contentSlide(pptx, 'The Problem', [
  'Morocco loses €200M+ per year to counterfeit terroir products.',
  '',
  'Not because certifications don\'t exist.',
  'Not because cooperatives aren\'t doing their job.',
  'Not because labs aren\'t testing.',
  '',
  'Because everything that matters is on paper. In Arabic. In a drawer.',
  'Invisible at 9pm to a buyer in Frankfurt.',
  '',
  'A cooperative in Taliouine holds every ONSSA certificate, every lab result.',
  'A German importer asks for "a verifiable digital certificate" before signing €80,000.',
  'She cannot provide it.  →  She loses the contract.',
  '',
  'This happens hundreds of times a year across Morocco\'s 1,800+ SDOQ cooperatives.',
]);

tableSlide(pptx, 'The Market Opportunity', [
  ['Metric', 'Value'],
  ['SDOQ-registered cooperatives in Morocco', '1,800+'],
  ['Official SDOQ labels (AOP / IGP / Label Agricole)', '22'],
  ['Annual terroir export value', '€300M+'],
  ['Estimated annual loss to counterfeits', '€180–220M'],
  ['EU Farm-to-Fork digital traceability deadline', '2030'],
  ['Cooperatives without digital certification today', '~98%'],
], { colWidths: [5.5, 3.5] });

contentSlide(pptx, 'The Solution — One QR Code', [
  'Terroir.ma adds a digital layer on top of the existing SDOQ process without replacing any step.',
  '',
  '① Cooperative registers in 15 minutes',
  '② Harvest logged with GPS farm coordinates',
  '③ Lab results submitted digitally',
  '④ Inspector files report via tablet',
  '⑤ Certification body grants or denies',
  '⑥ One atomic transaction generates:',
  '      • Cryptographically signed QR code (HMAC-SHA256)',
  '      • Sequential certification number: TERROIR-IGP-TLN-2025-018',
  '      • Trilingual verification payload: French · Arabic · Tifinagh',
  '      • Immutable audit trail of every step',
  '',
  'Anyone scans the QR → 1.8 seconds → full chain → no intermediaries.',
]);

tableSlide(pptx, 'Technology Stack', [
  ['Component', 'Choice', 'Why it matters'],
  ['API Framework', 'NestJS 10 / TypeScript strict', 'Hexagonal, testable, production-grade'],
  ['Database', 'PostgreSQL 16 + PostGIS 3.4', 'Farm GPS, ACID guarantees, JSONB lab params'],
  ['Event Bus', 'Redpanda (Kafka-compatible)', '18 events, DLQ, idempotent processing'],
  ['Auth', 'Keycloak 24 (OIDC)', '9 roles, JWT, zero custom auth code'],
  ['Cache', 'Redis 7', 'QR verification < 200ms p99'],
  ['QR Signing', 'HMAC-SHA256', 'Same algorithm used by international banks'],
  ['Architecture', 'Modular monolith → microservices', 'Clean extraction path in Phase 3'],
], { colWidths: [2.2, 3.2, 4.0] });

tableSlide(pptx, 'Competitive Advantage', [
  ['Platform', 'Country', 'Amazigh Support', 'Signed QR', 'Local Law'],
  ['INAO Digital', 'France', '✗', '✗', 'French only'],
  ['DOP Portal', 'Italy', '✗', '✗', 'Italian only'],
  ['AgriTrace', 'Ghana', '✗', 'Partial', '✗'],
  ['Terroir.ma', 'Morocco', '✅ Tifinagh', '✅ HMAC-SHA256', '✅ Law 25-06'],
], { colWidths: [2.5, 1.6, 2.0, 1.9, 1.4] });

tableSlide(pptx, 'Business Model — 3 Revenue Lines', [
  ['Revenue Line', 'Price', 'Scale'],
  ['SaaS — Cooperatives', '200 MAD / month', '100K MAD/mo at 500 coops'],
  ['B2G — Government & Institutions', '500K–2M MAD / year', 'MAPMDREF / ONSSA contract'],
  ['Premium Export API', 'Custom SLA', 'EU importers, cert. bodies'],
  ['', '', ''],
  ['Before / After ROI', 'Before', 'After'],
  ['Certification cycle', '90 days', '9 days'],
  ['Buyer verification', 'Phone call + 3 days', 'QR scan in 2 seconds'],
  ['Counterfeit detection', 'Impossible', 'Fake QR returns 404'],
], { colWidths: [3.5, 3.0, 2.9] });

contentSlide(pptx, 'Traction & Timeline', [
  'Sprint 1 ✅  Foundation — 308 files · full infra · 4 domain modules · 40 test files',
  'Sprint 2 ✅  Core Logic — DB migrations · cooperative verify flow · sequential cert numbers',
  'Sprint 3 🔵  Certification API — end-to-end workflow · QR verification endpoint (in progress)',
  'Sprint 4 ⬜  Pilot Ready — 3 cooperatives · seeded data · Swagger docs · Prometheus monitoring',
  '',
  '204 story points planned  ·  99 delivered  ·  On schedule',
  '',
  'Architecture: 10 ADR documents · CNDP compliant · Testcontainers integration tests',
  'Tests run against real PostgreSQL databases — not mocks.',
]);

contentSlide(pptx, 'The Ask', [
  'We are not asking for a million dollars.',
  '',
  '① 3-COOPERATIVE PILOT (from MAPMDREF / ONSSA / cooperative federation)',
  '      12 weeks  ·  Real data  ·  Full impact report  ·  Zero infra cost to you',
  '',
  '② OFFICIAL COMPLIANCE ENDORSEMENT (from MAPMDREF Direction SDOQ)',
  '      One sentence: "Terroir.ma is Law 25-06 compliant"',
  '      That sentence is worth more to this platform than any investment round.',
  '',
  '③ STRATEGIC INVESTOR (agri-tech, impact, or EU market fund)',
  '      Series A pathway  ·  B2G contract support  ·  Morocco-first expansion',
  '',
  'The platform is built. The tests pass. The architecture is published.',
  'The only question: are you in?',
]);

closingSlide(pptx,
  'The woman who picks saffron threads by hand in Taliouine before dawn deserves the same protection a French AOC château gets in Bordeaux.\n\nReal argan oil deserves to be distinguishable from the fake — not by words, but by proof.\n\nMorocco\'s agricultural heritage — built over generations, earned with real labor, certified under real law — deserves digital infrastructure that protects it.',
  'Terroir.ma is that infrastructure. Built. Tested. Ready.',
  'ltr',
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — FRANÇAIS
// ══════════════════════════════════════════════════════════════════════════════
sectionSlide(pptx, 'SECTION 2', 'Français — MAPMDREF · ONSSA · Investisseurs francophones · Partenaires stratégiques');

contentSlide(pptx, 'Le Problème', [
  'Le Maroc perd plus de 200 millions d\'euros par an à cause des produits terroir contrefaits.',
  '',
  'Pas parce que les certifications n\'existent pas.',
  'Pas parce que les coopératives ne font pas leur travail.',
  'Pas parce que les laboratoires ne testent pas.',
  '',
  'Parce que tout ce qui compte est sur papier. En arabe. Dans un tiroir.',
  'Invisible à 21h pour un acheteur à Francfort.',
  '',
  'Fatima dirige une coopérative de 28 membres à Taliouine.',
  'Un importateur allemand demande "un certificat numérique vérifiable" avant de signer 80 000 €.',
  'Elle ne peut pas le fournir.  →  Elle perd le contrat.',
  '',
  'Cette situation se reproduit des centaines de fois par an.',
]);

tableSlide(pptx, 'Le Marché', [
  ['Indicateur', 'Valeur'],
  ['Coopératives SDOQ enregistrées', '1 800+'],
  ['Labels SDOQ officiels', '22'],
  ['Valeur annuelle des exportations terroir', '300 M€+'],
  ['Perte annuelle due aux contrefaçons', '180–220 M€'],
  ['Échéance Farm-to-Fork (traçabilité numérique UE)', '2030'],
  ['Coopératives sans certification numérique', '~98 %'],
], { colWidths: [5.5, 3.5] });

contentSlide(pptx, 'La Solution — Un QR Code', [
  'Terroir.ma ajoute une couche numérique au-dessus du processus SDOQ existant — sans remplacer une seule étape.',
  '',
  '① Enregistrement coopérative en 15 minutes',
  '② Récolte saisie avec coordonnées GPS',
  '③ Résultats laboratoire soumis numériquement',
  '④ Inspecteur dépose son rapport sur tablette',
  '⑤ Organisme de certification accorde ou refuse',
  '⑥ Une transaction atomique génère :',
  '      • QR code signé cryptographiquement (HMAC-SHA256)',
  '      • Numéro séquentiel : TERROIR-AOP-SOUSS-2025-047',
  '      • Payload trilingue : Français · Arabe · Tifinagh',
  '      • Piste d\'audit immuable de chaque étape',
  '',
  'N\'importe qui scanne le QR → 1,8 seconde → chaîne complète → sans intermédiaire.',
]);

tableSlide(pptx, 'Avantage Concurrentiel', [
  ['Plateforme', 'Pays', 'Tifinagh', 'QR signé', 'Loi locale'],
  ['INAO Digital', 'France', '✗', '✗', 'Loi française'],
  ['DOP Portal', 'Italie', '✗', '✗', 'Loi italienne'],
  ['AgriTrace', 'Ghana', '✗', 'Partiel', '✗'],
  ['Terroir.ma', 'Maroc', '✅ Tifinagh', '✅ HMAC-SHA256', '✅ Loi 25-06'],
], { colWidths: [2.5, 1.6, 2.0, 1.9, 1.4] });

tableSlide(pptx, 'Modèle Économique — 3 Lignes de Revenus', [
  ['Ligne de revenus', 'Prix', 'Échelle'],
  ['SaaS — Coopératives', '200 MAD / mois', '100 K MAD/mois à 500 coopératives'],
  ['B2G — Institutions publiques', '500 K–2 M MAD / an', 'Contrat annuel MAPMDREF / ONSSA'],
  ['API Export Premium', 'SLA sur devis', 'Importateurs UE, organismes cert.'],
  ['', '', ''],
  ['Avant / Après ROI', 'Avant', 'Après'],
  ['Cycle de certification', '90 jours', '9 jours'],
  ['Vérification acheteur', 'Appel + 3 jours', 'Scan QR en 2 secondes'],
  ['Protection contrefaçon', 'Impossible', 'Faux QR retourne 404'],
], { colWidths: [3.5, 3.0, 2.9] });

contentSlide(pptx, 'État d\'Avancement', [
  'Sprint 1 ✅  Fondations — 308 fichiers · infra complète · 4 modules · 40 fichiers de tests',
  'Sprint 2 ✅  Logique métier — migrations · flow vérification · numéros de certification séquentiels',
  'Sprint 3 🔵  API certification — cycle complet · endpoint vérification QR (en cours)',
  'Sprint 4 ⬜  Pilot ready — 3 coopératives · données seedées · Swagger · Prometheus (planifié)',
  '',
  '204 story points planifiés  ·  99 livrés  ·  Dans les délais',
  '',
  'Architecture : 10 ADR publiés · conforme CNDP · tests Testcontainers',
  'Les tests s\'exécutent sur de vraies bases de données — pas des mocks.',
]);

contentSlide(pptx, 'La Demande', [
  'Nous ne demandons pas un million de dollars.',
  '',
  '① PILOTE 3 COOPÉRATIVES (de MAPMDREF / ONSSA / Fédération)',
  '      12 semaines  ·  Données réelles  ·  Rapport d\'impact complet  ·  Zéro coût infra',
  '',
  '② AVAL DE CONFORMITÉ OFFICIEL (Direction SDOQ — MAPMDREF)',
  '      Une phrase : "Terroir.ma est conforme à la Loi 25-06"',
  '      Cette phrase vaut plus que n\'importe quel tour d\'investissement.',
  '',
  '③ INVESTISSEUR STRATÉGIQUE (agri-tech, impact ou marché UE)',
  '      Pathway Series A  ·  Support contrats B2G  ·  Expansion Maroc-first',
  '',
  'La plateforme est construite. Les tests passent. L\'architecture est publiée.',
  'La seule question : êtes-vous avec nous ?',
]);

closingSlide(pptx,
  'La femme qui récolte des filaments de safran à la main à Taliouine avant l\'aube mérite la même protection qu\'un château AOC bordelais.\n\nL\'huile d\'argan authentique mérite d\'être distinguable du faux — pas par des mots, mais par la preuve.\n\nLe patrimoine agricole marocain — construit sur des générations, gagné avec un travail réel, certifié sous une vraie loi — mérite une infrastructure numérique qui le protège.',
  'Terroir.ma est cette infrastructure. Construite. Testée. Prête.',
  'ltr',
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — DARIJA / ARABIC
// ══════════════════════════════════════════════════════════════════════════════
sectionSlide(pptx, 'القسم الثالث', 'بالدارجة المغربية — التعاونيات · المستثمرين المغاربة · هيئات القطاع الفلاحي', 'rtl');

contentSlide(pptx, 'المشكلة', [
  'المغرب كيخسر +200 مليون أورو فالسنة بسبب المنتجات الفلاحية المزورة.',
  '',
  'مشي لأن الشهادات ما كاينة.',
  'مشي لأن التعاونيات ما خدامة.',
  'مشي لأن المخابر ما كتحلل.',
  '',
  'لأن كل حاجة مهمة — على ورقة. بالعربية. فدرج. ما مبينة فبرلين الساعة 9 ديال الليل.',
  '',
  'فاطمة — رئيسة تعاونية فتالوين — عندها كل الوثائق على ورق.',
  'زبون من ألمانيا طلب "شهادة رقمية" قبل ما يوقع عقد 80,000 أورو.',
  'هي ما قدرت تجيبو جواب.  →  خسرات العقد.',
  '',
  'هاد الموقف كيتكرر بمئات المرات كل سنة فكوبيراتيفات المغرب.',
], { lang: 'rtl' });

tableSlide(pptx, 'حجم السوق', [
  ['المؤشر', 'القيمة'],
  ['+1,800 كوبيراتيف', 'مسجلة SDOQ فالمغرب'],
  ['22 علامة رسمية', 'AOP · IGP · Label Agricole'],
  ['+300 مليون أورو', 'صادرات سنوية ديال المنتجات ذات التسمية'],
  ['180–220 مليون أورو', 'خسارة سنوية بسبب التزوير'],
  ['2030', 'الاتحاد الأوروبي كيفرض التتبع الرقمي على المنتجات المستوردة'],
  ['~98%', 'التعاونيات بلا رقمنة دابا'],
], { lang: 'rtl', colWidths: [3.5, 5.5] });

contentSlide(pptx, 'الحل — QR code واحد', [
  'Terroir.ma كتضيف طبقة رقمية فوق العملية الموجودة — بلا ما تبدل حتى خطوة.',
  '',
  '① الكوبيراتيف تسجل في 15 دقيقة',
  '② الحصاد يتسجل مع إحداثيات GPS ديال الضيعة',
  '③ المخبر يدخل النتائج رقميًا',
  '④ المفتش يملأ تقريرو بالتابلت',
  '⑤ هيئة المصادقة تمنح أو ترفض',
  '⑥ فالحين كيتولد:',
  '      • QR code موقع رقميًا بـ HMAC-SHA256 — ما يتزورش',
  '      • رقم تسلسلي: TERROIR-IGP-TLN-2025-018',
  '      • معلومات بالفرنسية والعربية والتيفيناغ',
  '      • سجل لا يمحى لكل خطوة',
  '',
  'أي شخص يسكان QR → 2 ثانية → كلشي مبيَّن → بلا وسيط.',
], { lang: 'rtl' });

tableSlide(pptx, 'أين نحن من المنافسة', [
  ['المنصة', 'البلد', 'التيفيناغ', 'QR موقع', 'القانون المحلي'],
  ['INAO Digital', 'فرنسا', '✗', '✗', 'القانون الفرنسي'],
  ['DOP Portal', 'إيطاليا', '✗', '✗', 'القانون الإيطالي'],
  ['AgriTrace', 'غانا', '✗', 'جزئي', '✗'],
  ['Terroir.ma', 'المغرب', '✅ تيفيناغ', '✅ HMAC-SHA256', '✅ القانون 25-06'],
], { lang: 'rtl', colWidths: [2.5, 1.6, 2.0, 1.9, 1.4] });

tableSlide(pptx, 'النموذج الاقتصادي', [
  ['خط الدخل', 'السعر', 'الحجم'],
  ['SaaS مع التعاونيات', '200 درهم / شهر', '100,000 درهم/شهر عند 500 كوبيراتيف'],
  ['B2G مع الدولة والهيئات', '500,000 – 2,000,000 درهم/سنة', 'عقد سنوي MAPMDREF / ONSSA'],
  ['API premium للتصدير', 'حسب الاتفاق', 'المستوردين الأوروبيين'],
  ['', '', ''],
  ['قبل / بعد', 'قبل Terroir.ma', 'مع Terroir.ma'],
  ['مدة الشهادة', '90 يوم', '9 أيام'],
  ['التحقق من الزبون', 'تيليفون + 3 أيام', 'سكان QR في 2 ثانية'],
  ['الكشف عن التزوير', 'مستحيل', 'QR مزور كيعطي 404'],
], { lang: 'rtl', colWidths: [3.5, 3.0, 2.9] });

contentSlide(pptx, 'وين وصلنا', [
  'Sprint 1 ✅  308 ملف — البنية الكاملة، كل الinfra، 4 modules',
  'Sprint 2 ✅  قاعدة البيانات، عملية التحقق، الأرقام التسلسلية للشهادات',
  'Sprint 3 🔵  الدورة الكاملة للشهادة، endpoint التحقق من QR (جاري)',
  'Sprint 4 ⬜  تجربة 3 كوبيراتيفات، Swagger، monitoring (مخطط)',
  '',
  '204 story points مخططة  ·  99 منجزة  ·  فالوقت',
  '',
  'المعمارية: 10 ADR منشورة · مطابق للـ CNDP · اختبارات Testcontainers',
  'الاختبارات كتشتغل على قواعد بيانات حقيقية — مشي mocks.',
], { lang: 'rtl' });

contentSlide(pptx, 'شنو كنطلبو', [
  'ما طلبناش مليون دولار.',
  '',
  '① برنامج تجريبي — 3 كوبيراتيفات (من MAPMDREF · ONSSA · الفيدرالية)',
  '      12 أسبوع  ·  بيانات حقيقية  ·  تقرير كامل  ·  ما كاين حتى تكلفة بنية تحتية',
  '',
  '② مصادقة رسمية على المطابقة (المديرية ديال SDOQ)',
  '      جملة واحدة: "Terroir.ma مطابق للقانون 25-06"',
  '      هاد الجملة تسوى أكثر من أي جولة استثمار.',
  '',
  '③ شريك مستثمر (صندوق agri-tech أو impact أو سوق أوروبي)',
  '      pathway Series A  ·  دعم عقود B2G  ·  توسع المغرب أولًا',
  '',
  'المنصة مبنية. الاختبارات ناجحة. المعمارية منشورة.',
  'السؤال الوحيد: واش أنتم معنا؟',
], { lang: 'rtl' });

closingSlide(pptx,
  'المرأة اللي كتلقط خيوط الزعفران بيديها باكر فتالوين كتستاهل نفس الحماية اللي كيحمل بها شاتو أوروبي.\n\nزيت الأركان الأصلي كيستاهل يتميز عن المزيف — مشي بالكلام — بالإثبات.\n\nالتراث الفلاحي المغربي — مبني عبر الأجيال، مكسوب بعمل حقيقي، مصادق عليه بقانون حقيقي — كيستاهل بنية تحتية رقمية تحميه.',
  'Terroir.ma هي هاد البنية. مبنية. مختبرة. جاهزة.',
  'rtl',
);

// ─── Write ────────────────────────────────────────────────────────────────────
const outFile = path.join(OUT_DIR, 'PITCH-DECK.pptx');
fs.mkdirSync(OUT_DIR, { recursive: true });

pptx.writeFile({ fileName: outFile }).then(() => {
  console.log(`✅  PITCH-DECK.pptx  →  ${outFile}`);
}).catch((err) => {
  console.error('❌  Failed to write PPTX:', err.message);
  process.exit(1);
});
