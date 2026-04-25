import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const verifyLatency = new Trend('qr_verify_latency', true);

// Hard domain SLA: QR verification must be < 200ms at p95 (Redis-cached path)
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m',  target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    qr_verify_latency: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Seed token — generate with: npm run export:openapi, then obtain from /api/v1/qr/seed
// In CI, override via QR_TOKEN env var with a seeded value from the test DB
const QR_TOKEN = __ENV.QR_TOKEN || 'test-qr-token-seed';

export default function () {
  const url = `${BASE_URL}/api/v1/qr/verify?token=${QR_TOKEN}`;

  const res = http.get(url, {
    tags: { name: 'qr-verify' },
  });

  const latency = res.timings.duration;
  verifyLatency.add(latency);

  const ok = check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'response under 200ms': (r) => r.timings.duration < 200,
    'has success field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.success === 'boolean';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);
  sleep(0.1);
}
