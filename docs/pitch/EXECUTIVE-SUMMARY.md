# Terroir.ma — Executive Summary

> _"Your certification. Proved. Everywhere." · "Votre certification. Prouvée. Partout." · "شهادتك. مثبتة. في كل مكان."_

---

---

# SECTION 1 — ENGLISH

### One-Page Briefing for Institutional Decision-Makers & International Partners

---

## What We Built

**Terroir.ma** is the first digital certification platform for Moroccan SDOQ terroir products — built under Law 25-06, trilingual (French · Arabic · Tifinagh), and designed to make authentic Moroccan cooperatives provable to any buyer, anywhere in the world, in under 2 seconds.

---

## The Problem, in One Paragraph

Morocco has 1,800+ SDOQ-registered cooperatives producing €300M+ in annual terroir exports. The certification process is legally valid, institutionally rigorous, and completely invisible outside Morocco. When a buyer in Frankfurt asks for "a verifiable digital certificate" at 9pm, a cooperative holding a perfectly valid ONSSA certificate on paper cannot answer. Contracts are cancelled. €200M+ per year is lost to counterfeits and blocked shipments. The infrastructure for trust exists. The digital layer does not.

---

## The Solution, in One Paragraph

Terroir.ma adds a digital layer on top of the existing SDOQ process without replacing any step. A cooperative registers in 15 minutes. Harvest logs with GPS. Lab results submit digitally. Inspector files via tablet. The certification body grants or denies. One atomic database transaction generates a cryptographically signed QR code (HMAC-SHA256), a sequential certification number (`TERROIR-AOP-SOUSS-2025-047`), and a trilingual verification payload — permanently immutable, verifiable by any phone on earth in 1.8 seconds.

---

## What Makes It Different

| Claim                         | Proof                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Built for Law 25-06 SDOQ      | Certification number format, 3 label types, 9-role Keycloak model all map directly to the law |
| Tamper-proof QR               | HMAC-SHA256 — same algorithm used by international banks                                      |
| Trilingual including Amazigh  | fr-MA + ar-MA + zgh (Tifinagh) — the only SDOQ platform globally with this                    |
| CNDP compliant by design      | PII redacted from all logs and Kafka events — not added after the fact                        |
| Production-grade from day one | 308 source files, 40 test files, 10 ADRs, Testcontainers integration tests                    |

---

## Business Model

| Stream             | Price              | Scale                              |
| ------------------ | ------------------ | ---------------------------------- |
| Cooperative SaaS   | 200 MAD / month    | 100K MAD/mo at 500 coops           |
| B2G institutional  | 500K–2M MAD / year | MAPMDREF / ONSSA annual contract   |
| Premium export API | Custom SLA         | EU importers, certification bodies |

---

## Where We Stand — April 2026

- **Sprint 1 complete:** 308 files, full infrastructure, all 4 domain modules
- **Sprint 2 complete:** Database migrations, cooperative verify flow, sequential certification numbers
- **Sprint 3 in progress:** End-to-end certification API, QR verification endpoint
- **Sprint 4 planned:** 3-cooperative pilot, Swagger documentation, monitoring

---

## The Ask

A 12-week pilot with 3 certified cooperatives. Zero infrastructure cost to MAPMDREF. Full impact report at the end. A single sentence of official endorsement — "Terroir.ma is compliant with Law 25-06" — is worth more to this platform than any investment round.

**Contact:** terroir.ma · rhorba.mohamed@gmail.com

---

---

# SECTION 2 — FRANÇAIS

### Note de synthèse d'une page pour les décideurs institutionnels et partenaires stratégiques

---

## Ce que nous avons construit

**Terroir.ma** est la première plateforme marocaine de certification numérique des produits SDOQ terroir — conforme à la Loi 25-06, trilingue (Français · Arabe · Tifinagh), conçue pour rendre les coopératives marocaines authentiques prouvables auprès de n'importe quel acheteur, partout dans le monde, en moins de 2 secondes.

---

## Le problème, en un paragraphe

Le Maroc compte 1 800+ coopératives SDOQ enregistrées produisant plus de 300 M€ d'exportations terroir par an. Le processus de certification est légalement valide, institutionnellement rigoureux, et totalement invisible en dehors du Maroc. Quand un acheteur à Francfort demande "un certificat numérique vérifiable" à 21h, une coopérative détenant un certificat ONSSA parfaitement valide sur papier ne peut pas répondre. Les contrats sont annulés. Plus de 200 M€ par an sont perdus à cause des contrefaçons et des expéditions bloquées. L'infrastructure de confiance existe. La couche numérique, non.

---

## La solution, en un paragraphe

Terroir.ma ajoute une couche numérique au-dessus du processus SDOQ existant sans remplacer une seule étape. Une coopérative s'enregistre en 15 minutes. Les récoltes sont saisies avec GPS. Les résultats du labo sont soumis numériquement. L'inspecteur dépose son rapport sur tablette. L'organisme de certification accorde ou refuse. Une transaction atomique génère un QR code signé cryptographiquement (HMAC-SHA256), un numéro de certification séquentiel (`TERROIR-AOP-SOUSS-2025-047`), et un payload de vérification trilingue — immuable, vérifiable par n'importe quel téléphone en 1,8 seconde.

---

## Ce qui nous différencie

| Affirmation                           | Preuve                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Construit pour la Loi 25-06 SDOQ      | Format de numéro de certification, 3 types de labels, modèle Keycloak 9 rôles directement alignés sur la loi |
| QR infalsifiable                      | HMAC-SHA256 — même algorithme que les banques internationales                                                |
| Trilingue avec Amazigh                | fr-MA + ar-MA + zgh (Tifinagh) — la seule plateforme SDOQ au monde avec ça                                   |
| Conformité CNDP par conception        | PII absent des logs et des événements Kafka — pas ajouté après coup                                          |
| Architecture production dès le départ | 308 fichiers sources, 40 fichiers de tests, 10 ADR, tests d'intégration Testcontainers                       |

---

## Modèle économique

| Ligne              | Prix               | Échelle                                      |
| ------------------ | ------------------ | -------------------------------------------- |
| SaaS coopératives  | 200 MAD / mois     | 100 K MAD/mois à 500 coopératives            |
| B2G institutionnel | 500 K–2 M MAD / an | Contrat annuel MAPMDREF / ONSSA              |
| API export premium | SLA sur devis      | Importateurs UE, organismes de certification |

---

## État d'avancement — Avril 2026

- **Sprint 1 terminé :** 308 fichiers, infrastructure complète, 4 modules domaines
- **Sprint 2 terminé :** Migrations, flow vérification, numéros de certification séquentiels
- **Sprint 3 en cours :** API certification bout-en-bout, endpoint vérification QR
- **Sprint 4 planifié :** Pilote 3 coopératives, documentation Swagger, monitoring

---

## La demande

Un pilote de 12 semaines avec 3 coopératives certifiées. Zéro coût d'infrastructure pour le MAPMDREF. Rapport d'impact complet à la fin. Une seule phrase d'aval officiel — "Terroir.ma est conforme à la Loi 25-06" — vaut plus pour cette plateforme que n'importe quel tour d'investissement.

**Contact :** terroir.ma · rhorba.mohamed@gmail.com

---

---

# القسم 3 — بالدارجة المغربية

### ملخص تنفيذي لصانعي القرار والشركاء الاستراتيجيين

---

## شنو بنينا

**Terroir.ma** هي أول منصة مغربية لرقمنة شهادات SDOQ ديال المنتجات الفلاحية ذات التسمية — مطابقة للقانون 25-06، بثلاث لغات (فرنسية · عربية · تيفيناغ) — مبنية باش كل كوبيراتيف مغربي أصيل يكون مثبَّت عند أي زبون فأي بلد في أقل من ثانيتين.

---

## المشكلة — فجملة واحدة

المغرب عنده +1,800 كوبيراتيف مسجلة SDOQ كتصدر +300 مليون أورو من المنتجات الفلاحية كل سنة. الشهادات موجودة، صحيحة قانونيًا — لكنها على ورق وبالعربية — وما مبيناش خارج المغرب. واحد الزبون فألمانيا كيطلب "شهادة رقمية نقدر نتحقق منها الليلة" — الكوبيراتيف عندها الشهادة على ورق — ما قادرة تجيب جواب. العقد يتلغى. هاد المشكلة كتكلف المغرب +200 مليون أورو فالسنة. البنية التقنية ديال الثقة موجودة — الطبقة الرقمية ما كاينة.

---

## الحل — فجملة واحدة

Terroir.ma كتضيف طبقة رقمية فوق عملية SDOQ الموجودة بلا ما تبدل حتى خطوة واحدة. الكوبيراتيف تسجل في 15 دقيقة، الحصاد يتسجل مع GPS، المخبر يدخل نتائجو رقميًا، المفتش يكمل تقريرو بالتابلت، هيئة المصادقة تمنح أو ترفض — فالحين transaction واحدة في قاعدة البيانات كتولد QR code موقع رقميًا (HMAC-SHA256) ورقم شهادة تسلسلي `TERROIR-IGP-TLN-2025-018` ومعلومات بثلاث لغات — لا يتغيرو، يتحقق منهم بأي تيليفون في 2 ثانية.

---

## شنو كيميزنا

| الادعاء                            | الإثبات                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| مبنيين على القانون 25-06 SDOQ      | صيغة رقم الشهادة، 3 أنواع علامات، نموذج الـ9 أدوار Keycloak — كلو مرتبط مباشرة بالقانون |
| QR لا يتزور                        | HMAC-SHA256 — نفس الخوارزمية ديال البنوك الدولية                                        |
| ثلاث لغات مع التيفيناغ             | fr-MA + ar-MA + zgh — وحدنا فالعالم عندنا هاد الدعم                                     |
| CNDP مدمج من البداية               | معطيات الأشخاص محمية من logs وكافكا — مشي مضافة بعدين                                   |
| Architecture production من أول يوم | 308 ملف، 40 ملف اختبارات، 10 ADR، tests حقيقية مع قواعد بيانات حقيقية                   |

---

## النموذج الاقتصادي

| الخط                   | السعر                        | الحجم                                 |
| ---------------------- | ---------------------------- | ------------------------------------- |
| SaaS مع التعاونيات     | 200 درهم / شهر               | 100,000 درهم/شهر عند 500 كوبيراتيف    |
| B2G مع الدولة والهيئات | 500,000 – 2,000,000 درهم/سنة | عقد سنوي MAPMDREF / ONSSA             |
| API premium للتصدير    | حسب الاتفاق                  | المستوردين الأوروبيين، هيئات المصادقة |

---

## وين وصلنا — أبريل 2026

- **Sprint 1 تمّ:** 308 ملف، infra كاملة، 4 modules
- **Sprint 2 تمّ:** migrations، عملية التحقق، الأرقام التسلسلية
- **Sprint 3 جاري:** API الشهادة كاملة، endpoint التحقق من QR
- **Sprint 4 مخطط:** تجربة 3 كوبيراتيفات، Swagger، monitoring

---

## شنو كنطلبو

12 أسبوع تجربة مع 3 كوبيراتيفات معتمدة. ما كاين حتى تكلفة بنية تحتية على MAPMDREF. تقرير كامل فالنهاية. جملة رسمية واحدة — "Terroir.ma مطابق للقانون 25-06" — تسوى أكثر من أي جولة استثمار.

**للتواصل:** terroir.ma · rhorba.mohamed@gmail.com

---

_Terroir.ma · من الأرض إلى الكود · De la terre au QR code. Prouvé._
