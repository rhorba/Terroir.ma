# Velocity Tracker

## Sprint Velocity History

| Sprint | Goal                                                                 | Planned Points | Completed Points | Velocity % | Notes                                                                                  |
| ------ | -------------------------------------------------------------------- | -------------- | ---------------- | ---------- | -------------------------------------------------------------------------------------- |
| 1      | Infrastructure Scaffold                                              | ~89            | 89               | 100%       | 12-day scaffold sprint — atypical; high setup cost                                     |
| 2      | Certification Chain Steps 1–7 + Vertical Slice                       | 30             | 30               | 100%       | 1-day feature sprint                                                                   |
| 3      | Certification Chain Steps 8–12                                       | 21             | 21               | 100%       | 1-day completion sprint                                                                |
| 4      | Production Readiness (coverage ≥80%, Redis QR cache, migrations)     | 21             | 21               | 100%       | 1-session sprint — 210 unit tests, 98.35% stmt coverage                                |
| 5      | List Endpoints, QR Download & Trilingual Verification                | 23             | 22               | 96%        | 1-session sprint — 245 unit tests, 98.41% stmt coverage; TM-3 deferred (needs live DB) |
| 6      | PDF Certificate, Stats, Export Clearances, Notification Templates    | 22             | 21               | 95%        | 1-session sprint — 278 unit tests; TM-3 deferred again                                 |
| 7      | Schema Drift Fix, Deactivation, Product Types, Inspector, Stats      | 20             | 20               | 100%       | 1-session sprint — 293 unit tests; TM-3 finally resolved                               |
| 8      | Inspector Reads, Processing Steps, Lab History, MAPMDREF Export      | 24             | 24               | 100%       | 1-session sprint — 312 unit tests; US-018/US-029 free (no guard change needed)         |
| 9      | MinIO File Storage, Lab Registry, Document Uploads, Export PDF       | 22             | 22               | 100%       | 1-session sprint — 342 unit tests; MinIO infrastructure added                          |
| 10     | Admin Dashboard, Certification Analytics, Audit Logs, Delivery Rates | 24             | 24               | 100%       | 1-session sprint — 357 unit tests; AuditInterceptor global pattern                     |

## Rolling Average Velocity

| Window                            | Average         |
| --------------------------------- | --------------- |
| Last 1 sprint (Sp 10)             | 24 SP           |
| Last 2 sprints (Sp 9+10)          | 23.0 SP/session |
| Last 3 sprints (Sp 8+9+10)        | 23.3 SP/session |
| Last 5 sprints (Sp 6–10)          | 22.2 SP/session |
| All-time (feature sprints Sp2–10) | 22.8 SP/session |

_Sprint 1 excluded from rolling average — scaffold sprint is not representative of feature velocity._

## Capacity Notes

- Single-developer project
- Feature velocity stable: **~22–24 SP per sprint** (based on Sp 2–10)
- Sprint 11 planning target: **21–25 SP**
- Sprints 2–10 all single-session — `/brainstorm → /plan → /execute` workflow is consistently effective
- Sprint 5: 96% — TM-3 deferred due to live PostgreSQL dependency (not a velocity concern)
- Sprint 6: 95% — TM-3 deferred again (same reason)
- Sprints 7–10: 100% each — steady-state feature delivery
- 9 stories (~60 SP) remaining — completion in ~2–3 sprints at current velocity

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
