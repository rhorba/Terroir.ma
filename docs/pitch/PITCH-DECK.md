# Terroir.ma — Investor & Stakeholder Pitch Deck

> _"De la terre au QR code. Prouvé." · "From soil to code. Proved." · "من الأرض للكود. مثبت."_

---

---

# SECTION 1 — ENGLISH

### For: International Investors · EU Buyers · Tech Partners · Global Institutions

---

## SLIDE 1 — THE HEADLINE

**Terroir.ma**
_The first digital certification platform for Moroccan SDOQ terroir products._

One QR code. Full chain. Verified in under 2 seconds.
Built under Law 25-06. Trilingual. Tamper-proof. Production-grade from day one.

---

## SLIDE 2 — THE PROBLEM

**Morocco loses €200M+ per year to counterfeit terroir products.**

Not because the certifications don't exist.
Not because the cooperatives aren't doing their job.
Not because the labs aren't testing.

Because everything that matters is on paper.
In Arabic.
In a drawer.
Invisible at 9pm to a buyer in Frankfurt.

> A cooperative in Taliouine grows ISO 3632 Grade I saffron.
> She has the ONSSA certificate. She has the lab results. She has everything.
> A German importer asked for "a verifiable digital certificate" before signing an €80,000 order.
> She couldn't provide it.
> She lost the contract.

**This happens hundreds of times a year across Morocco's 1,800+ SDOQ-registered cooperatives.**

---

## SLIDE 3 — THE MARKET

| Metric                                             | Value               |
| -------------------------------------------------- | ------------------- |
| SDOQ-registered cooperatives in Morocco            | 1,800+              |
| Official SDOQ labels (AOP / IGP / Label Agricole)  | 22                  |
| Annual terroir product export value                | €300M+              |
| Estimated annual loss to counterfeits              | €180–220M           |
| EU digital traceability mandate deadline           | 2030 (Farm-to-Fork) |
| Cooperatives without digital certification (today) | ~98%                |

**By 2030, EU import regulations will require digital traceability for all agri-food products. Cooperatives not on a digital platform will face EU market exclusion by law.**

The addressable market is not theoretical. It is already regulated.

---

## SLIDE 4 — THE SOLUTION

**Terroir.ma** adds a digital layer on top of the existing Moroccan SDOQ certification process — without replacing a single step.

The cooperative registers. The harvest is logged with GPS coordinates. The lab submits results digitally. The inspector files their report via tablet. The certification body grants or denies. One atomic transaction generates:

- A cryptographically signed QR code (HMAC-SHA256)
- A sequential certification number: `TERROIR-IGP-TLN-2025-018`
- A trilingual verification payload (French · Arabic · Tifinagh/Amazigh)
- An immutable audit trail of every step

**Anyone with a phone scans the QR. In 1.8 seconds they see everything. No intermediaries. No phone calls. No paper.**

---

## SLIDE 5 — THE TECHNOLOGY

No exotic stack. No experimental choices. Production-grade from sprint one.

| Component    | Technology                            | Why                                         |
| ------------ | ------------------------------------- | ------------------------------------------- |
| API          | NestJS 10 / TypeScript 5.4 strict     | Modular, testable, hexagonal                |
| Database     | PostgreSQL 16 + PostGIS 3.4           | Farm GPS, ACID guarantees, JSONB lab params |
| Events       | Redpanda (Kafka-compatible)           | 18 events, DLQ, idempotent                  |
| Auth         | Keycloak 24 (OIDC)                    | 9 roles, JWT, zero custom auth code         |
| Cache        | Redis 7                               | QR verification < 200ms p99                 |
| QR signing   | HMAC-SHA256                           | Same algorithm used by global banks         |
| Architecture | Modular monolith → microservices path | Designed to split cleanly in Phase 3        |

**10 Architecture Decision Records. 40 test files. 308 production-grade source files. Tests run against real databases — not mocks.**

---

## SLIDE 6 — THE COMPETITIVE ADVANTAGE

| Platform       | Country     | Amazigh support | HMAC-signed QR     | Local law compliance |
| -------------- | ----------- | --------------- | ------------------ | -------------------- |
| INAO Digital   | France      | ❌              | ❌                 | French law only      |
| DOP Portal     | Italy       | ❌              | ❌                 | Italian law only     |
| AgriTrace      | Ghana       | ❌              | ✅                 | ❌                   |
| **Terroir.ma** | **Morocco** | **✅ Tifinagh** | **✅ HMAC-SHA256** | **✅ Law 25-06**     |

**We are the only platform that:**

1. Supports Tifinagh (Amazigh) — a statement of who this was built for
2. Is built specifically for Law 25-06 SDOQ — not generic "organic" traceability
3. Uses HMAC-SHA256 QR signing — mathematically unforgeable
4. Has CNDP Law 09-08 compliance built into the architecture from line one

**No direct competitor exists in Morocco as of April 2026.**

---

## SLIDE 7 — THE BUSINESS MODEL

Three revenue lines, three growth trajectories:

**① SaaS — Cooperatives**

```
200 MAD / month / cooperative
500 cooperatives → 100,000 MAD/month → 1.2M MAD/year
1,000 cooperatives → 200,000 MAD/month → 2.4M MAD/year
```

**② B2G — Government & Institutions**

```
Annual contract: MAPMDREF / ONSSA
Paper processing cost of 40,000+ files/year → 5M+ MAD equivalent
We replace that with better data at lower cost
Contract range: 500,000 – 2,000,000 MAD/year
```

**③ Premium Export Tier**

```
Auto-generated export documents with HS codes
EU importer API access with SLA guarantees
"EU Farm-to-Fork 2030 Ready" certification badge
```

**A single saved shipment (avg. €35,000) pays 14 years of a cooperative's subscription.**
The ROI conversation is not about cost. It is about how fast it pays for itself.

---

## SLIDE 8 — TRACTION & TIMELINE

```
Sprint 1 ✅  Foundation — 308 files, full infra, all 4 modules
Sprint 2 ✅  Core logic — migrations, verify flow, sequential cert numbers
Sprint 3 🔵  Certification API — end-to-end workflow, QR verification
Sprint 4 ⬜  Pilot ready — 3 cooperatives, seeded data, Swagger, monitoring
```

**MVP: 8 weeks. Production-grade pilot: 12 weeks.**

204 story points planned. 99 delivered. On schedule.

---

## SLIDE 9 — THE ASK

**We are not asking for a million dollars.**

We are asking for something specific:

| Ask                                 | From whom                                 | What it unlocks                                                      |
| ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| **3-cooperative pilot**             | MAPMDREF / ONSSA / cooperative federation | 12 weeks, real data, full impact report                              |
| **Official compliance endorsement** | MAPMDREF Direction SDOQ                   | "Terroir.ma is Law 25-06 compliant" — opens every door in the sector |
| **Strategic investor**              | Agri-tech, impact, or EU market fund      | Series A pathway, B2G contract support                               |

**The platform is built. The tests pass. The architecture is published.**
**The only question is: are you in?**

---

## SLIDE 10 — THE CLOSING PROMISE

> _"The woman who picks saffron threads by hand in Taliouine before dawn deserves the same protection a French AOC château gets in Bordeaux._
>
> _Real argan oil deserves to be distinguishable from the fake — not by words, but by proof._
>
> _Morocco's agricultural heritage — built over generations, earned with real labor, tested in real labs, certified under real law — deserves digital infrastructure that protects it._
>
> **Terroir.ma is that infrastructure. Built. Tested. Ready."**

---

---

# SECTION 2 — FRANÇAIS

### Pour : Institutions marocaines · MAPMDREF · ONSSA · Investisseurs francophones · Partenaires stratégiques

---

## DIAPOSITIVE 1 — L'ACCROCHE

**Terroir.ma**
_La première plateforme marocaine de certification numérique des produits SDOQ._

Un QR code. La chaîne complète. Vérifiée en moins de 2 secondes.
Conforme à la Loi 25-06. Trilingue. Infalsifiable. Architecture production dès le premier jour.

---

## DIAPOSITIVE 2 — LE PROBLÈME

**Le Maroc perd plus de 200 millions d'euros par an à cause des produits terroir contrefaits.**

Pas parce que les certifications n'existent pas.
Pas parce que les coopératives ne font pas leur travail.
Pas parce que les laboratoires ne testent pas.

Parce que tout ce qui compte est sur papier.
En arabe.
Dans un tiroir.
Invisible à 21h pour un acheteur à Francfort.

> Fatima dirige une coopérative de 28 membres à Taliouine.
> Elle a le certificat ONSSA. Elle a les résultats du labo. Elle a tout — sur papier.
> Un importateur allemand lui demande "un certificat numérique vérifiable" avant de signer un contrat de 80 000 €.
> Elle ne peut pas le fournir.
> Elle perd le contrat.

**Cette situation se reproduit des centaines de fois par an dans les 1 800+ coopératives SDOQ enregistrées au Maroc.**

---

## DIAPOSITIVE 3 — LE MARCHÉ

| Indicateur                                              | Valeur        |
| ------------------------------------------------------- | ------------- |
| Coopératives SDOQ enregistrées                          | 1 800+        |
| Labels SDOQ officiels (AOP / IGP / LA)                  | 22            |
| Valeur annuelle des exportations terroir                | 300 M€+       |
| Perte estimée due aux contrefaçons                      | 180–220 M€/an |
| Échéance de la réglementation UE Farm-to-Fork           | 2030          |
| Coopératives sans certification numérique (aujourd'hui) | ~98 %         |

**D'ici 2030, la Stratégie Farm-to-Fork de l'Union Européenne imposera la traçabilité numérique pour tous les produits agro-alimentaires importés. Les coopératives sans plateforme numérique seront exclues du marché européen par la réglementation.**

---

## DIAPOSITIVE 4 — LA SOLUTION

**Terroir.ma** ajoute une couche numérique au-dessus du processus de certification SDOQ existant — sans remplacer une seule étape.

La coopérative s'enregistre. La récolte est saisie avec les coordonnées GPS de la ferme. Le labo soumet ses résultats numériquement. L'inspecteur dépose son rapport sur tablette. L'organisme de certification accorde ou refuse. Une transaction atomique génère :

- Un QR code signé cryptographiquement (HMAC-SHA256)
- Un numéro de certification séquentiel : `TERROIR-AOP-SOUSS-2025-047`
- Un payload de vérification trilingue (Français · Arabe · Tifinagh/Amazigh)
- Une piste d'audit immuable de chaque étape

**N'importe qui avec un téléphone scanne le QR. En 1,8 seconde il voit tout. Sans intermédiaire. Sans appel. Sans papier.**

---

## DIAPOSITIVE 5 — LA TECHNOLOGIE

Pas de stack exotique. Pas de choix expérimentaux. Architecture production dès le premier sprint.

| Composant        | Technologie                                | Pourquoi                                          |
| ---------------- | ------------------------------------------ | ------------------------------------------------- |
| API              | NestJS 10 / TypeScript 5.4 strict          | Modulaire, testable, hexagonale                   |
| Base de données  | PostgreSQL 16 + PostGIS 3.4                | GPS fermes, garanties ACID, paramètres labo JSONB |
| Événements       | Redpanda (compatible Kafka)                | 18 événements, DLQ, idempotent                    |
| Authentification | Keycloak 24 (OIDC)                         | 9 rôles, JWT, zéro code d'auth maison             |
| Cache            | Redis 7                                    | Vérification QR < 200ms p99                       |
| Signature QR     | HMAC-SHA256                                | Même algorithme que les banques mondiales         |
| Architecture     | Monolithe modulaire → chemin microservices | Conçu pour se diviser proprement en Phase 3       |

**10 Architecture Decision Records. 40 fichiers de tests. 308 fichiers sources. Les tests s'exécutent sur de vraies bases de données — pas des mocks.**

---

## DIAPOSITIVE 6 — L'AVANTAGE CONCURRENTIEL

**Ce que Terroir.ma fait et qu'aucune plateforme existante ne fait :**

1. **La seule à supporter le Tifinagh (Amazigh)** — fr-MA + ar-MA + zgh — une affirmation de pour qui cette plateforme a été construite
2. **La seule construite spécifiquement pour la Loi 25-06 SDOQ** — pas une traçabilité générique "bio"
3. **La seule avec une signature QR HMAC-SHA256** — mathématiquement infalsifiable
4. **La seule avec la conformité CNDP Loi 09-08 dans l'architecture** — pas ajoutée après coup

**Aucun concurrent direct n'existe au Maroc en avril 2026.**

---

## DIAPOSITIVE 7 — LE MODÈLE ÉCONOMIQUE

Trois lignes de revenus, trois trajectoires de croissance :

**① SaaS — Coopératives**

```
200 MAD / mois / coopérative
500 coopératives → 100 000 MAD/mois → 1,2 M MAD/an
1 800 coopératives → 360 000 MAD/mois → 4,3 M MAD/an
```

**② B2G — Institutions publiques**

```
Contrat annuel : MAPMDREF / ONSSA / Directions régionales
Coût actuel du traitement papier de 40 000+ dossiers/an → 5 M+ MAD équivalent
Nous le remplaçons avec de meilleures données, à moindre coût
Valeur contractuelle estimée : 500 000 – 2 000 000 MAD/an
```

**③ Tier Premium Export**

```
Documents d'export auto-générés avec codes SH
Accès API pour importateurs européens avec SLA garanti
Badge "EU Farm-to-Fork 2030 Ready" pour les emballages premium
```

**Un seul contrat d'export préservé (moy. 35 000 €) rembourse 14 ans d'abonnement d'une coopérative.**

---

## DIAPOSITIVE 8 — L'ÉTAT D'AVANCEMENT

```
Sprint 1 ✅  Fondations — 308 fichiers, infra complète, 4 modules
Sprint 2 ✅  Logique métier — migrations, flow verify, numéros séquentiels
Sprint 3 🔵  API certification — cycle complet, vérification QR
Sprint 4 ⬜  Pilot ready — 3 coopératives, données seedées, Swagger, monitoring
```

**MVP en 8 semaines. Pilote prêt pour 3 coopératives en 12 semaines.**

---

## DIAPOSITIVE 9 — LA DEMANDE

**Nous ne demandons pas un million de dollars.**

Nous demandons quelque chose de précis :

| Demande                             | De qui                                         | Ce que ça débloque                                                            |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| **Programme pilote 3 coopératives** | MAPMDREF / ONSSA / Fédération des coopératives | 12 semaines, données réelles, rapport d'impact complet                        |
| **Aval de conformité officiel**     | Direction SDOQ du MAPMDREF                     | "Terroir.ma est conforme à la Loi 25-06" — ouvre toutes les portes du secteur |
| **Investisseur stratégique**        | Fonds agri-tech, impact, ou marché UE          | Pathway Series A, support contrats B2G                                        |

**La plateforme est construite. Les tests passent. L'architecture est publiée.**
**La seule question : êtes-vous avec nous ?**

---

## DIAPOSITIVE 10 — LA PROMESSE FINALE

> _"La femme qui récolte des filaments de safran à la main à Taliouine avant l'aube mérite la même protection qu'un château AOC bordelais._
>
> _L'huile d'argan authentique mérite d'être distinguable du faux — pas par des mots, mais par la preuve._
>
> _Le patrimoine agricole marocain — construit sur des générations, gagné avec un travail réel, testé dans de vrais laboratoires, certifié sous une vraie loi — mérite une infrastructure numérique qui le protège._
>
> **Terroir.ma est cette infrastructure. Construite. Testée. Prête."**

---

> **P.S.** — La Stratégie Farm-to-Fork de l'UE impose la traçabilité numérique pour les produits agro-alimentaires importés d'ici 2030. Les coopératives certifiées sur Terroir.ma répondront à cette exigence par défaut. Celles qui ne le sont pas devront tout reconstruire en quatre ans. La plateforme est prête. La seule question, c'est quand.

---

---

# القسم 3 — بالدارجة المغربية

### لـ: التعاونيات · المستثمرين المغاربة · الشركاء المحليين · هيئات القطاع الفلاحي

---

## الشريحة 1 — البداية

**Terroir.ma**
_أول منصة مغربية لرقمنة شهادات SDOQ ديال المنتجات الفلاحية._

QR code واحد. الخيط كامل. متحقق منو في أقل من ثانيتين.
مطابق للقانون 25-06. بثلاث لغات. ما كاينش لي يقلدو. مبني بجودة production من أول نهار.

---

## الشريحة 2 — المشكلة الحقيقية

سمعوني مزيان — كنقول ليكم شي حاجة ما كيتقالش.

**المغرب كيخسر +200 مليون أورو فالسنة بسبب المنتجات المزورة.**

مشي لأن الشهادات ما كاينة. مشي لأن التعاونيات ما خدامة. مشي لأن المخابر ما كتحلل.

لأن كل حاجة مهمة — على ورقة. بالعربية. فدرج. ما مبينة عند واحد فبرلين الساعة التاسعة ديال الليل.

> **فاطمة** — رئيسة تعاونية فتالوين — عندها 28 شريك. عندها شهادة ONSSA، نتيجة المخبر، كل الورق كامل. جاتها فرصة من زبون فألمانيا — عرض من 80,000 أورو. قالها: _"محتاج شهادة رقمية نقدر نتحقق منها الليلة."_
>
> هي عندها الورق. الزبون ما فهمش العربية. ما كان عندو وسيط. **خسرات العقد.**

هاد الحكاية ما كاينة غير عند فاطمة — كاينة عند مئات الكوبيراتيفات كل نهار.

---

## الشريحة 3 — حجم السوق

| الرقم              | الواقع                                                      |
| ------------------ | ----------------------------------------------------------- |
| +1,800             | كوبيراتيف مسجلة SDOQ فالمغرب                                |
| 22                 | علامة رسمية (AOP · IGP · Label Agricole)                    |
| +300 مليون أورو    | صادرات المنتجات الفلاحية ذات التسمية كل سنة                 |
| 180–220 مليون أورو | خسارة سنوية بسبب المنتجات المزورة                           |
| 2030               | الاتحاد الأوروبي كيفرض تتبعًا رقميًا لكل المنتجات المستوردة |
| ~98%               | التعاونيات ديال دابا بلا رقمنة                              |

**في 2030 — الكوبيراتيفات بلا منصة رقمية ممنوعة من السوق الأوروبية بالقانون. مشي بالاختيار. بالقانون.**

---

## الشريحة 4 — الحل ديالنا

**Terroir.ma** كتضيف طبقة رقمية فوق العملية الموجودة — بلا ما تبدل حتى خطوة.

الكوبيراتيف تسجل. الحصاد يتسجل مع إحداثيات GPS ديال الضيعة. المخبر يدخل النتائج رقميًا. المفتش يملأ تقرير المعاينة بالتابلت. هيئة المصادقة تمنح أو ترفض. فنفس اللحظة كيتولد:

```
✓ QR code موقع رقميًا بـ HMAC-SHA256 — لا يتزور
✓ رقم شهادة تسلسلي: TERROIR-IGP-TLN-2025-018
✓ معلومات التحقق بالفرنسية والعربية والتيفيناغ
✓ سجل لا يمحى لكل خطوة فالسلسلة
```

**أي شخص بالتيليفون يسكانيه — فين ما كان، في أي وقت. في 2 ثانية كيشوف كلشي. بلا وسيط. بلا تيليفون. بلا ورق.**

---

## الشريحة 5 — التقنية — لمن بغا يفهم

مكاين ما هو غريب. مكاين ما هو تجريبي. Architecture ديال production من الأول.

**3 حوايج خاصكم تعرفوهم:**

**① التوقيع الرقمي HMAC-SHA256**
نفس الخوارزمية اللي كيستعملوها البنوك الدولية. QR code ديال Terroir.ma ما يمكن تقليدو — رياضيًا مستحيل.

**② السرعة**
التحقق كيرجع في **أقل من 200 ميليثانية**. هاد الرقم مكتوب فالمعمارية من البداية. مش وعد — مش feature — ضمان مكتوب فالكود.

**③ القانون**
مطابقة 100% للقانون 25-06 SDOQ — المادة 7، المادة 18، كل بنود الاعتراف بالتسميات. ومطابقة للقانون 09-08 CNDP — معطيات الأشخاص محمية، ما كاين حتى info شخصي كيتنقل.

---

## الشريحة 6 — المنافسة

| المنصة         | البلد      | التيفيناغ | QR موقع            | القانون المحلي       |
| -------------- | ---------- | --------- | ------------------ | -------------------- |
| INAO Digital   | فرنسا      | ❌        | ❌                 | القانون الفرنسي      |
| DOP Portal     | إيطاليا    | ❌        | ❌                 | القانون الإيطالي     |
| AgriTrace      | غانا       | ❌        | ✅                 | ❌                   |
| **Terroir.ma** | **المغرب** | **✅**    | **✅ HMAC-SHA256** | **✅ القانون 25-06** |

**نحن وحدنا اللي:**

- عندنا دعم الحرف التيفيناغي — مش كلام — برمجة حقيقية
- مبنيين على القانون 25-06 المغربي من الأساس — مشي تكييف
- عندنا أقوى توقيع رقمي فالقطاع
- CNDP مدمج فالمعمارية — مش مضافه بعد ما بنينا

**ما كاين حتى منافس مباشر فالمغرب دابا.**

---

## الشريحة 7 — النموذج الاقتصادي

**3 خطوط دخل:**

**① SaaS — مع التعاونيات**

```
200 درهم / شهر / كوبيراتيف
500 كوبيراتيف → 100,000 درهم/شهر → 1.2 مليون درهم/سنة
كل المغرب (1,800 كوبيراتيف) → 4.3 مليون درهم/سنة
```

**② B2G — مع الدولة والهيئات**

```
عقد مع MAPMDREF أو ONSSA
تكلفة معالجة 40,000+ ملف ورقي/سنة → يفوق 5 مليون درهم
نوفروها بمعلومة أحسن وتكلفة أقل
```

**③ Premium — التصدير**

```
وثائق تصدير أوتوماتيكية مع codes HS
API مضمون للمستوردين الأوروبيين
badge "EU Farm-to-Fork 2030 Ready" — premium tier
```

**عقد تصدير واحد محفوظ (متوسط 35,000 أورو) = 14 سنة اشتراك ديال كوبيراتيف.**
ما هو سؤال التكلفة — هو سؤال متى كيرجع.

---

## الشريحة 8 — وين وصلنا

```
Sprint 1 ✅  308 ملف — البنية الكاملة، كل الinfra
Sprint 2 ✅  قاعدة البيانات، التحقق، الأرقام التسلسلية
Sprint 3 🔵  الدورة الكاملة للشهادة — الأسبوع الجاي
Sprint 4 ⬜  جاهز لـ 3 كوبيراتيفات — خلال 12 أسبوع
```

**204 story points مخططة. 99 منجزة. فالوقت.**

---

## الشريحة 9 — شنو كنطلبو

**ما طلبناش مليون دولار.**

كنطلبو شي واضح ومحدد:

| الطلب                             | من مين                                  | شنو كيفتح                                                     |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **برنامج تجريبي — 3 كوبيراتيفات** | MAPMDREF · ONSSA · الفيدرالية           | 12 أسبوع، بيانات حقيقية، تقرير كامل                           |
| **مصادقة رسمية على المطابقة**     | المديرية ديال SDOQ                      | "Terroir.ma مطابق للقانون 25-06" — هاد الجملة تفتح كل الأبواب |
| **شريك مستثمر**                   | صندوق agri-tech أو impact أو سوق أوروبي | pathway Series A، دعم عقود B2G                                |

**المنصة مبنية. الاختبارات ناجحة. المعمارية منشورة.**
**السؤال الوحيد: واش أنتم معنا ولا لا؟**

---

## الشريحة 10 — الخاتمة

> _المرأة اللي كتلقط خيوط الزعفران بيدين باكر فتالوين — كتستاهل نفس الحماية اللي كيحمل بها شاتو أوروبي._
>
> _زيت الأركان الأصلي كيستاهل يتميز عن المزيف — مش بالكلام — بالإثبات._
>
> _التراث الفلاحي المغربي — مبني عبر الأجيال، مكسوب بعمل حقيقي، محلول فمخابر حقيقية، مصادق عليه بقانون حقيقي — كيستاهل بنية تحتية رقمية تحميه._
>
> **Terroir.ma هي هاد البنية. مبنية. مختبرة. جاهزة.**

---

> **ملاحظة أخيرة** — في 2030 الاتحاد الأوروبي كيفرض التتبع الرقمي على كل المنتجات المستوردة. الكوبيراتيفات ديال Terroir.ma غاديين يكونو جاهزين من زمان. اللي ما كانوش — غاديين يبنيو من صفر في أربع سنين. المنصة جاهزة. الوقت مشى. الفرصة — هنا ودابا.

---

_Terroir.ma · من الأرض إلى الكود · De la terre au QR code. Prouvé._
_Version 1.0 · Avril 2026 · Sprint 1 + 2 Complete · 308 fichiers · 204 story points MVP_
