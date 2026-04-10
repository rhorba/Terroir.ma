# Velocity Tracker

## Sprint Velocity History

| Sprint | Goal                                                             | Planned Points | Completed Points | Velocity % | Notes                                                                                  |
| ------ | ---------------------------------------------------------------- | -------------- | ---------------- | ---------- | -------------------------------------------------------------------------------------- |
| 1      | Infrastructure Scaffold                                          | ~89            | 89               | 100%       | 12-day scaffold sprint — atypical; high setup cost                                     |
| 2      | Certification Chain Steps 1–7 + Vertical Slice                   | 30             | 30               | 100%       | 1-day feature sprint                                                                   |
| 3      | Certification Chain Steps 8–12                                   | 21             | 21               | 100%       | 1-day completion sprint                                                                |
| 4      | Production Readiness (coverage ≥80%, Redis QR cache, migrations) | 21             | 21               | 100%       | 1-session sprint — 210 unit tests, 98.35% stmt coverage                                |
| 5      | List Endpoints, QR Download & Trilingual Verification            | 23             | 22               | 96%        | 1-session sprint — 245 unit tests, 98.41% stmt coverage; TM-3 deferred (needs live DB) |

## Rolling Average Velocity

| Window                          | Average         |
| ------------------------------- | --------------- |
| Last 1 sprint (Sp 5)            | 22 SP           |
| Last 2 sprints (Sp 4+5)         | 21.5 SP/session |
| Last 3 sprints (Sp 3+4+5)       | 21.3 SP/session |
| Last 4 sprints (Sp 2+3+4+5)     | 23 SP/session   |
| All-time (feature sprints only) | 23 SP/session   |

_Sprint 1 excluded from rolling average — scaffold sprint is not representative of feature velocity._

## Capacity Notes

- Single-developer project
- Feature velocity stable: **~21–25 SP per sprint** (based on Sp 2–5)
- Sprint 6 planning target: **21–25 SP**
- Sprints 2–5 all single-session — `/brainstorm → /plan → /execute` workflow is consistently effective
- Sprint 5: 96% — TM-3 deferred due to live PostgreSQL dependency (not a velocity concern)
- Real-world feature sprints may take longer when external dependencies (Keycloak, Redis, PostgreSQL) require live infrastructure

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
