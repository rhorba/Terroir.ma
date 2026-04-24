# Velocity Tracker

## Sprint Velocity History

| Sprint | Goal                                                                             | Planned Points | Completed Points | Velocity % | Notes                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------- | -------------- | ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1      | Infrastructure Scaffold                                                          | ~89            | 89               | 100%       | 12-day scaffold sprint — atypical; high setup cost                                                                                                                 |
| 2      | Certification Chain Steps 1–7 + Vertical Slice                                   | 30             | 30               | 100%       | 1-day feature sprint                                                                                                                                               |
| 3      | Certification Chain Steps 8–12                                                   | 21             | 21               | 100%       | 1-day completion sprint                                                                                                                                            |
| 4      | Production Readiness (coverage ≥80%, Redis QR cache, migrations)                 | 21             | 21               | 100%       | 1-session sprint — 210 unit tests, 98.35% stmt coverage                                                                                                            |
| 5      | List Endpoints, QR Download & Trilingual Verification                            | 23             | 22               | 96%        | 1-session sprint — 245 unit tests, 98.41% stmt coverage; TM-3 deferred (needs live DB)                                                                             |
| 6      | PDF Certificate, Stats, Export Clearances, Notification Templates                | 22             | 21               | 95%        | 1-session sprint — 278 unit tests; TM-3 deferred again                                                                                                             |
| 7      | Schema Drift Fix, Deactivation, Product Types, Inspector, Stats                  | 20             | 20               | 100%       | 1-session sprint — 293 unit tests; TM-3 finally resolved                                                                                                           |
| 8      | Inspector Reads, Processing Steps, Lab History, MAPMDREF Export                  | 24             | 24               | 100%       | 1-session sprint — 312 unit tests; US-018/US-029 free (no guard change needed)                                                                                     |
| 9      | MinIO File Storage, Lab Registry, Document Uploads, Export PDF                   | 22             | 22               | 100%       | 1-session sprint — 342 unit tests; MinIO infrastructure added                                                                                                      |
| 10     | Admin Dashboard, Certification Analytics, Audit Logs, Delivery Rates             | 24             | 24               | 100%       | 1-session sprint — 357 unit tests; AuditInterceptor global pattern                                                                                                 |
| 11     | System Config, Reports, Preferences                                              | 24             | 24               | 100%       | 1-session sprint — 382 unit tests; 12 new endpoints; 2 migrations; zero Kafka events                                                                               |
| 12     | v1 Hardening — QR Scan Events, ENV Validation, OpenAPI, Tests                    | 13             | 13               | 100%       | 1-session sprint — 386 unit · 29 integration · 35 E2E; openapi.json generated; v1 DONE                                                                             |
| FE-S1  | Frontend Scaffold — pnpm workspace, codegen, shadcn/ui, next-intl, Docker        | 13             | 13               | 100%       | 1-session sprint — terroir-ma-web created; 5 Windows-specific fixes resolved                                                                                       |
| FE-S2  | Auth — NextAuth v5 + Keycloak OIDC + role guard + 7 layout shells                | 13             | 13               | 100%       | 1-session sprint — 27 files; 0 typecheck errors; build green; jose edge warnings (benign)                                                                          |
| FE-S3  | Super-Admin Portal — cooperative verify/reject, labs, SDOQ specs, settings       | 13             | 13               | 100%       | 1-session sprint — 33 files (31 FE + 2 BE patch); 22 portal routes; 0 typecheck/lint errors; next build green; terroir-ma-web pushed to GitHub                     |
| FE-S4  | Cooperative-Admin Portal — members, farms, products, batches list + detail       | 13             | 13               | 100%       | 1-session sprint — 16 files (14 FE + 2 BE patch); 8 new routes (30 total); getCooperativeId() auth helper; GET /cooperatives/:id/farms backend gap patched         |
| FE-S5  | Inspector Portal — inspection schedule, report form, batch/product read views    | 13             | 13               | 100%       | 1-session sprint — 8 files; 3 new routes (32 total); fileReport Server Action; ReportForm client with radio passed/failed                                          |
| FE-S6  | Lab-Technician Portal — queue list, test detail, result form, PDF upload, submit | 13             | 13               | 100%       | 1-session sprint — 9 files; 3 new routes (35 total); dynamic fields by productType; PDF upload via fetch (multipart); two portals shipped same day (FE-S5 + FE-S6) |
| FE-S7  | Certification-Body Portal — dashboard, pending list, grant/deny/revoke forms     | 13             | 13               | 100%       | 1-session sprint — 8 files; 3 new routes (38 total); 5 Server Actions; stats from analytics byRegion sum                                                           |
| FE-S8  | Cooperative-Member Portal — dashboard, harvests (list+new), batches (list+new)   | 13             | 13               | 100%       | 1-session sprint — 10 files; 4 new routes (42 total); Set<string> harvest selection; auto-sum totalQuantityKg                                                      |
| FE-S9  | Consumer QR Public App + i18n Polish — typed verify page, locale fix             | 8              | 8                | 100%       | 1-session sprint — 12 files; fixed /api/v1/verify URL bug; removed /fr/ hardcoding from all 7 layouts; status badge                                                |
| FE-S10 | Customs-Agent Portal + E2E Playwright + Docker Prod Build                        | 15             | 15               | 100%       | 1-session sprint — 19 files; 45 portal routes; 11 Playwright smoke tests; Dockerfiles fixed for pnpm monorepo; **v1 COMPLETE**                                     |

## Rolling Average Velocity

| Window                                    | Average         |
| ----------------------------------------- | --------------- |
| Last 1 sprint (FE-S10)                    | 15 SP           |
| Last 3 sprints (FE-S8 → FE-S10)           | 12.3 SP/session |
| Last 4 sprints (FE-S7 → FE-S10)           | 12.5 SP/session |
| Last 10 sprints (FE-S1 → FE-S10)          | 12.7 SP/session |
| All-time backend (feature sprints Sp2–12) | 21.5 SP/session |
| Frontend only (FE-S1–S10)                 | 12.7 SP/session |

_Sprint 1 and FE-S1 excluded from backend rolling average — scaffold sprints are not representative of feature velocity._
_Frontend sprints tracked separately — scope differs from backend feature sprints._

## Capacity Notes

- Single-developer project
- Backend feature velocity: **~22–24 SP per sprint** (Sp 2–11 steady state)
- Frontend sprint velocity: **11–15 SP/sprint** (FE-S1–S8 at 13; FE-S9 at 8 — polish sprint; FE-S10 at 15 — final sprint)
- Sprints 2–FE-S10 all single-session — `/brainstorm → /plan → /execute` workflow consistently effective
- Sprint 5: 96% — TM-3 deferred due to live PostgreSQL dependency
- Sprint 6: 95% — TM-3 deferred again (same reason)
- Sprints 7–FE-S10: 100% each
- FE-S5 and FE-S6 both shipped in the same session (2026-04-23) — 26 SP in one day
- FE-S7, FE-S8, FE-S9 all shipped in one session (2026-04-23) — 34 SP in one day
- FE-S10 shipped 2026-04-24 — 15 SP in one day
- **v1 COMPLETE — all 10 frontend sprints done (127 SP total, 45 portal routes)**

## Velocity Chart

```
Points
 90 | ████████████████████████████████████████  ← Sprint 1 (scaffold, atypical)
 80 |
 70 |
 60 |
 50 |
 40 |
 30 |                    ████████████████████  ← Sprint 2 (30 SP)
 20 |                                    ████  ← Sprint 3 (21 SP)
 10 |
  0 +----------S1----------S2----------S3---->
                  Sprint
```

## Sprint 4 Planning

**Recommended capacity:** 25–30 SP

**Top candidates (by priority + value):**

| ID     | Story                                                        | Priority | SP  | Rationale                                  |
| ------ | ------------------------------------------------------------ | -------- | --- | ------------------------------------------ |
| —      | `npm run test:cov` — record coverage baseline                | High     | 1   | Action item from Sp 3 retro                |
| US-042 | Certification officer views pending requests (list endpoint) | Medium   | 3   | Unblocks daily cert-body workflow          |
| US-049 | Cooperative admin views all their certifications             | Low      | 3   | Completes the certification portfolio view |
| US-057 | Download QR code image                                       | Medium   | 3   | Needed for physical packaging              |
| US-059 | QR verification page in Arabic/French/Amazigh                | Medium   | 5   | RTL support + localization                 |
| US-066 | View export documentation status                             | Medium   | 3   | Customs-agent workflow start               |
| US-084 | MAPMDREF periodic certification reports (export)             | High     | 5   | Regulatory obligation                      |
| —      | Redis caching for QR verification (< 200ms SLA)              | High     | 5   | Performance requirement from CLAUDE.md     |
| —      | TypeORM migrations (replace `synchronize: true` in prod)     | High     | 5   | Production-readiness                       |

**Suggested Sprint 4 scope:** Coverage baseline + Redis QR cache + cert list endpoints + QR download = **~25 SP**

---

## How to Update

After each sprint retrospective:

1. Update the table above with actual completed points
2. Recalculate rolling averages
3. Adjust next sprint capacity estimate based on trend
4. Save this file and commit with message `docs: update velocity after sprint N`
