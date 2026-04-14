# Sprint 12 Log — v1 Hardening

**Sprint:** 12  
**Dates:** 2026-04-14 – 2026-04-27  
**Goal:** US-058 QR scan event tracking, Joi ENV validation, Swagger/OpenAPI export, font fallback, integration + E2E smoke tests  
**Planned SP:** 13  
**Completed SP:** 13  
**Status:** DONE (completed Day 1)

---

## Stories

| Story | Title | SP | Status |
|---|---|---|---|
| US-058 | Track QR code scan events | 5 | ✅ Done |
| (hardening) | Joi ENV validation | 2 | ✅ Done |
| (hardening) | Swagger/OpenAPI generation + export | 2 | ✅ Done |
| (hardening) | Font fallback (existsSync guard) | 1 | ✅ Done |
| (hardening) | Integration tests (4 new suites) | 2 | ✅ Done |
| (hardening) | E2E smoke tests (3 new suites) | 1 | ✅ Done |
| **Total** | | **13** | **13/13** |

---

## Tasks (22 total)

| # | Task | Status |
|---|---|---|
| 1 | Migration 017: AddQrScanEvent | ✅ |
| 2 | QrScanEvent entity | ✅ |
| 3 | QrCodeService: fire-and-forget write in verifyQrCode() | ✅ |
| 4 | ScanStatsResponseDto | ✅ |
| 5 | QrCodeService.getScanStats() + GET /certifications/:id/scan-stats | ✅ |
| 6 | CertificationModule: register QrScanEvent | ✅ |
| 7 | qr-code.service.spec.ts: +4 US-058 tests | ✅ |
| 8 | Install joi + env.validation.ts | ✅ |
| 9 | app.module.ts: ConfigModule validate wiring | ✅ |
| 10 | main.ts: SwaggerModule setup | ✅ |
| 11 | export-openapi.ts script + package.json script | ✅ |
| 12 | Controller annotations part 1 | ✅ |
| 13 | Controller annotations part 2 | ✅ |
| 14 | assets/fonts/.gitkeep + scripts/download-fonts.sh | ✅ |
| 15 | certification-pdf.service.ts + export-document-pdf.service.ts: font fallback | ✅ |
| 16 | test/integration/common/system-settings.integration.ts | ✅ |
| 17 | test/integration/common/audit-log.integration.ts | ✅ |
| 18 | test/integration/certification/qr-scan-event.integration.ts | ✅ |
| 19 | test/integration/notification/notification-preference.integration.ts | ✅ |
| 20 | test/e2e/smoke/cooperative-onboarding.e2e.ts | ✅ |
| 21 | test/e2e/smoke/certification-grant.e2e.ts | ✅ |
| 22 | test/e2e/smoke/qr-verify.e2e.ts | ✅ |

---

## Post-Sprint Checklist Results

| Step | Result |
|---|---|
| `npm run migration:run` | ✅ Migration 017 applied |
| Font assets | ✅ Pre-existing (Amiri + DejaVuSans) |
| `npm run export:openapi` | ✅ `docs/api/openapi.json` generated |
| `npm run test:integration` | ✅ 10/10 suites, 29/29 tests |
| `npm run test:e2e` | ✅ 8/8 suites, 35/35 tests |

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| QrScanEvent write | Fire-and-forget `.save().catch()` | Same pattern as AuditLog — never blocks response path |
| QrScanEvent.ipAddress | Explicit `type: 'varchar'` | TypeORM can't infer from `string \| null` union |
| getScanStats() | Raw SQL with `COUNT(*) FILTER (WHERE ...)` | Clean aggregation without ORM gymnastics |
| ENV validation | Joi, abortEarly:false | Shows ALL missing vars in one startup error, not one-at-a-time |
| OpenAPI export | `NestFactory.create(AppModule)` | Full bootstrap validates ENV — export reveals missing vars |
| Font fallback | existsSync + WARN log + Helvetica | PDF endpoints work in all environments without font assets |

---

## Bugs Found & Fixed (Post-Sprint Checklist)

1. `notification.service.integration.ts` — `NotificationPreferenceRepository` missing from test module
2. `notification-preference.integration.ts` — invalid UUID literal in `findOneBy()`
3. Smoke tests — `/api/v1/` prefix in paths (test app has no global prefix)
4. `certification-grant.e2e.ts` — `POST /certifications` → `POST /certifications/request`
5. `cooperative-onboarding.e2e.ts` — incomplete DTO body + `certificationTypes` not in DTO
6. `cooperative-onboarding.e2e.ts` — verify HTTP method `PUT` → `PATCH`
7. `cooperative-onboarding.e2e.ts` — post-verify status `'verified'` → `'active'`
8. `.env` — missing `MINIO_*` vars blocked `export:openapi` Joi validation

---

## Final Test Metrics

| Metric | Before | After |
|---|---|---|
| Unit tests | 382 | **386** |
| Integration suites | 8 | **10** |
| Integration tests | 25 | **29** |
| E2E suites | 5 | **8** |
| E2E tests | 22 | **35** |
| Failures | 0 | **0** |

---

## v1 Status

Sprint 12 is the **final feature sprint of v1**. All planned stories have been delivered.

**Backlog summary:** 86/90 stories done. 4 deferred to Phase 2:
- US-053: QR offline verification (13 SP, Medium)  
- US-027: ONSSA lab integration (13 SP, Low)  
- 2 minor stories

**Phase 2 candidates:** Monitoring (Prometheus/Grafana), distributed tracing (Jaeger), Kafka Schema Registry, performance testing (k6), security scanning (OWASP ZAP), Kubernetes deployment.
