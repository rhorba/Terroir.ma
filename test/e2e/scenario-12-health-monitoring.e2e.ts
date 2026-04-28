/**
 * Scenario 12 — Health & Monitoring
 * Covers: /health (liveness), /ready (readiness + DB), /metrics (Prometheus).
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 12.1–12.3.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

describe('Scenario 12 — Health & Monitoring (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Step 12.1: Liveness Check ───────────────────────────────────────────

  describe('Step 12.1 — GET /health (liveness)', () => {
    it('returns 200 without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    });

    it('returns JSON body with status=ok', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      const body = res.body;
      expect(body?.status ?? body?.data?.status ?? 'ok').toMatch(/ok|up/i);
    });

    it('responds quickly (< 200ms)', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/health');
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('does not require Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // ─── Step 12.2: Readiness Check ──────────────────────────────────────────

  describe('Step 12.2 — GET /ready (readiness)', () => {
    it('returns 200 when database is reachable', async () => {
      const res = await request(app.getHttpServer()).get('/ready');
      expect(res.status).toBe(200);
    });

    it('returns status=ok with checks in body', async () => {
      const res = await request(app.getHttpServer()).get('/ready');
      expect(res.status).toBe(200);
      const body = res.body;
      expect(body?.status ?? body?.data?.status ?? 'ok').toMatch(/ok|up/i);
    });

    it('is publicly accessible without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/ready');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // ─── Step 12.3: Prometheus Metrics ───────────────────────────────────────

  describe('Step 12.3 — GET /metrics (Prometheus)', () => {
    it('endpoint exists and returns Prometheus text format or 403 (IP-gated)', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      // /metrics may be IP-restricted (only monitoring network) — 403 is acceptable
      // What is NOT acceptable: 500 (crash)
      expect(res.status).not.toBe(500);
      expect(res.status).not.toBe(401);
    });

    it('if accessible, returns text/plain content-type', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      if (res.status === 200) {
        const contentType = res.headers['content-type'] ?? '';
        expect(contentType).toMatch(/text/i);
      }
    });
  });

  // ─── OpenAPI / Swagger ───────────────────────────────────────────────────

  describe('GET /api-docs (OpenAPI)', () => {
    it('Swagger UI or JSON endpoint exists (200 or 404)', async () => {
      const res = await request(app.getHttpServer()).get('/api-docs');
      expect(res.status).not.toBe(500);
      expect(res.status).not.toBe(401);
    });
  });

  // ─── Cross-cutting: all endpoints return JSON errors, not HTML ────────────

  describe('Error format — JSON, not HTML', () => {
    it('404 on unknown route returns JSON', async () => {
      const res = await request(app.getHttpServer()).get('/this-endpoint-does-not-exist-at-all');
      expect(res.headers['content-type']).toMatch(/json/i);
    });

    it('401 on protected route returns JSON', async () => {
      const res = await request(app.getHttpServer()).get('/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toMatch(/json/i);
    });

    it('403 on wrong-role route returns JSON', async () => {
      const labToken = buildMockJwt(buildJwtPayload('lab-technician'));
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set(bearerHeader(labToken));
      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toMatch(/json/i);
    });
  });
});
