import http from 'k6/http';
import { check } from 'k6';

// CI-safe smoke test: 1 VU, 1 iteration, no auth required.
// Verifies the API is reachable and liveness/readiness endpoints respond correctly.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const liveness = http.get(`${BASE_URL}/health`);
  check(liveness, {
    'liveness 200': (r) => r.status === 200,
  });

  const readiness = http.get(`${BASE_URL}/ready`);
  check(readiness, {
    'readiness 200': (r) => r.status === 200,
  });

  const publicQr = http.get(`${BASE_URL}/api/v1/qr/verify?token=smoke-test`);
  check(publicQr, {
    'qr verify reachable': (r) => r.status === 200 || r.status === 404 || r.status === 400,
  });
}
