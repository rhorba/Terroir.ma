# Sprint FE-S9 — Consumer QR Public App + i18n Polish

**Dates:** 2026-04-23 → 2026-04-23 (1 jour)
**Objectif:** Fix public QR verify page and remove hardcoded /fr/ locale from all portal sidebar layouts
**Statut:** COMPLETED ✅
**Vélocité:** 8/8 SP (100%)

---

## Stories couvertes

| Story | Description | SP | Statut |
|-------|-------------|-----|--------|
| US-057 | Consumer scans QR and sees full certification details | 5 | ✅ Done |
| US-058 | Portal sidebars work in ar/fr/zgh locales | 3 | ✅ Done |

---

## Tâches exécutées (13/13)

| # | Tâche | Fichiers | Statut |
|---|-------|----------|--------|
| 1 | api-public.ts — typed fetch helper | apps/public/src/lib/api-public.ts | ✅ |
| 2 | Rewrite verify/[uuid]/page.tsx | apps/public/src/app/[locale]/verify/[uuid]/page.tsx | ✅ |
| 3 | Update messages fr/ar/zgh | apps/public/messages/*.json | ✅ |
| 4 | Typecheck apps/public | — | ✅ |
| 5 | Fix super-admin layout | (super-admin)/super-admin/layout.tsx | ✅ |
| 6 | Fix cooperative-admin layout | (cooperative-admin)/cooperative-admin/layout.tsx | ✅ |
| 7 | Fix cooperative-member layout | (cooperative-member)/cooperative-member/layout.tsx | ✅ |
| 8 | Fix inspector layout | (inspector)/inspector/layout.tsx | ✅ |
| 9 | Fix lab-technician layout | (lab-technician)/lab-technician/layout.tsx | ✅ |
| 10 | Fix certification-body layout | (certification-body)/certification-body/layout.tsx | ✅ |
| 11 | Fix customs-agent layout | (customs-agent)/customs-agent/layout.tsx | ✅ |
| 12 | Typecheck apps/portal | — | ✅ |
| 13 | Lint + build both apps + commit + push | — | ✅ |

---

## Résultats

- Commit terroir-ma-web: `239ef36` sur origin/main
- Commit terroir-ma: `817c2b6` sur origin/main
- apps/public: 4 routes compilées ✅
- apps/portal: 42 routes compilées ✅
- Typecheck: 0 erreurs (public + portal)
- Lint: 0 warnings (public + portal)
- Backend unit tests: 391/391 ✅ (vérifiés via pre-push hook)

---

## Bugs corrigés

| Bug | Fix |
|-----|-----|
| `/verify/:uuid` (manque `/api/v1`) | Corrigé: `/api/v1/verify/:uuid?lang=` |
| `body.data` typé comme `CertificationVerification` plat | Lit maintenant `body.data.certification.*` correctement |
| Hardcoded `/fr/` dans 7 NAVs portail | `params.locale` template literals |
| `redirect('/fr/login')` dans 7 layouts | `` redirect(`/${locale}/login`) `` |
| Clés i18n `valid_from`, `cert_type` manquantes | Ajoutées dans fr/ar/zgh |

---

## Notes techniques

- `api-public.ts` dans `apps/public/src/lib/` — plus simple que créer `packages/api-client` pour un seul consommateur
- Backend `/api/v1/verify/:uuid?lang=` gère déjà la traduction serveur de `statusDisplay` + `message` — le frontend render simplement ces champs
- Layouts RSC reçoivent `params.locale` du App Router Next.js — pas besoin de hook client ni de `next-intl/navigation`
- Status badge: `currentStatus === 'GRANTED' || 'RENEWED'` → vert; `'REVOKED' || 'DENIED'` → rouge; autres → ambre
