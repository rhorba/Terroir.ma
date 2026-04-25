import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const listLatency = new Trend('certification_list_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    certification_list_latency: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// Bearer token for certification-body or customs-agent role
// Override via K6_TOKEN env var in CI
const TOKEN = __ENV.K6_TOKEN || '';

export default function () {
  const headers = TOKEN
    ? { Authorization: `Bearer ${TOKEN}` }
    : {};

  const res = http.get(`${BASE_URL}/api/v1/certifications?page=1&limit=20`, {
    headers,
    tags: { name: 'certification-list' },
  });

  const latency = res.timings.duration;
  listLatency.add(latency);

  const ok = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response under 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!ok);
  sleep(0.5);
}
