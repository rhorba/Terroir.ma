# Monitoring Plan

Phase 2 implementation — defined here in Phase 1 for planning.

## Key Metrics

### API Layer
| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Request rate (RPS) | Prometheus + NestJS metrics | — (baseline) |
| Error rate (4xx/5xx) | Prometheus | > 5% over 5 minutes → Slack |
| p50/p95/p99 latency per endpoint | Prometheus histogram | p99 > 500ms → Slack |
| `GET /verify/:uuid` latency | Prometheus | p99 > 200ms → PagerDuty |

### QR Verification
| Metric | Description | Target |
|--------|-------------|--------|
| Cache hit ratio | Redis hits / total requests | > 80% |
| Verification latency p99 | End-to-end | < 200ms |
| Invalid signature rate | Potential tampering attempts | Alert if > 10/min from single IP |

### Certification Pipeline
| Metric | Description |
|--------|-------------|
| Certifications requested per day | Trend analysis |
| Approval rate | % granted / total decided |
| Average time to decision | From request to grant/deny |
| Pending > 30 days | Alert certification body |

### Kafka
| Metric | Tool | Alert |
|--------|------|-------|
| Consumer lag per group | Redpanda metrics | lag > 1000 → Slack |
| DLQ message count | Custom Kafka consumer | > 0 → PagerDuty |
| Producer error rate | Kafka client metrics | > 1% → Slack |

### Notifications
| Metric | Description | Alert |
|--------|-------------|-------|
| Delivery success rate | sent / (sent + failed) | < 95% → Slack |
| Failed notifications per hour | Absolute count | > 10/hour → email to DevOps |
| Email bounce rate | SMTP 5xx responses | > 5% → investigate SMTP config |

### Database
| Metric | Alert |
|--------|-------|
| Connection pool utilization | > 80% → scale connections |
| Slow queries (> 100ms) | Log to Loki; > 10/min → Slack |
| Replication lag (Phase 2 replica) | > 30s → PagerDuty |

## Dashboards (Phase 2 Grafana)

1. **Certification Pipeline Overview** — funnel: requested → reviewed → granted/denied, avg time per stage
2. **Notification Delivery** — delivery rate by channel and language, failure breakdown
3. **Infrastructure Health** — CPU/memory per service, DB connections, Redis memory
4. **QR Verification** — RPS, latency heatmap, cache hit ratio, error map

## Health Endpoints

| Endpoint | What it checks | Used by |
|----------|---------------|---------|
| `GET /health` | Application alive (liveness) | Docker Compose healthcheck |
| `GET /ready` | PostgreSQL, Redis, Keycloak reachable (readiness) | Load balancer |
