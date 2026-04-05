# Kafka / Redpanda Topics Runbook

This runbook covers topic naming conventions, the full topic inventory, and operational commands for managing Kafka topics in Terroir.ma using Redpanda.

---

## Topic Naming Convention

All topics follow the pattern:

```
<module>.<entity>.<action>
```

| Segment | Values | Example |
|---------|--------|---------|
| `module` | `cooperative`, `product`, `certification`, `notification`, `lab` | `certification` |
| `entity` | The domain entity the event concerns | `decision` |
| `action` | Past-tense verb describing what happened | `granted` |

**Full example:** `certification.decision.granted`

---

## Full Topic List

### Cooperative Module

| Topic | Description |
|-------|-------------|
| `cooperative.registration.submitted` | A cooperative has submitted its registration application |
| `cooperative.registration.verified` | A super-admin has verified the cooperative's registration |
| `cooperative.registration.rejected` | A super-admin has rejected the cooperative's registration |
| `cooperative.member.added` | A new member has been added to a cooperative |

### Product Module

| Topic | Description |
|-------|-------------|
| `product.batch.created` | A new product batch has been recorded |
| `product.batch.updated` | A product batch record has been updated |
| `lab.test.submitted` | A lab test request has been submitted for a batch |
| `lab.test.completed` | Lab results have been filed for a batch |
| `lab.test.failed` | A batch has failed laboratory testing |

### Certification Module

| Topic | Description |
|-------|-------------|
| `certification.requested` | A cooperative admin has requested certification for a batch |
| `certification.inspection.scheduled` | An inspection has been scheduled |
| `certification.inspection.completed` | An inspector has filed the inspection report |
| `certification.decision.granted` | The certification body has granted certification |
| `certification.decision.denied` | The certification body has denied certification |
| `certification.revoked` | An active certification has been revoked |

### Notification Module

| Topic | Description |
|-------|-------------|
| `notification.email.requested` | An email notification has been queued for sending |
| `notification.sms.requested` | An SMS notification has been queued for sending |
| `notification.push.requested` | A push notification has been queued for sending |

**Total: 18 topics**

---

## Dead Letter Queue (DLQ) Topics

Every topic has a corresponding DLQ topic for messages that fail consumer processing. DLQ topic names append `.dlq` to the original topic name:

| Source Topic | DLQ Topic |
|-------------|----------|
| `certification.decision.granted` | `certification.decision.granted.dlq` |
| `notification.email.requested` | `notification.email.requested.dlq` |
| _(all 18 topics follow this pattern)_ | |

When a consumer fails to process a message after the configured retry count, it produces the original message to the `.dlq` topic for manual inspection and replay.

---

## Creating Topics

### Via Redpanda Console (UI)

1. Open http://localhost:8080
2. Navigate to **Topics** in the left sidebar
3. Click **Create Topic**
4. Set:
   - **Name:** e.g. `certification.decision.granted`
   - **Partitions:** `3`
   - **Replication factor:** `1` (local dev) / `3` (production)
5. Click **Create**

### Via CLI (rpk)

```bash
rpk topic create <topic-name> \
  --brokers localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

**Example — create a DLQ topic:**

```bash
rpk topic create certification.decision.granted.dlq \
  --brokers localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

**Create all 18 topics in a loop:**

```bash
TOPICS=(
  cooperative.registration.submitted
  cooperative.registration.verified
  cooperative.registration.rejected
  cooperative.member.added
  product.batch.created
  product.batch.updated
  lab.test.submitted
  lab.test.completed
  lab.test.failed
  certification.requested
  certification.inspection.scheduled
  certification.inspection.completed
  certification.decision.granted
  certification.decision.denied
  certification.revoked
  notification.email.requested
  notification.sms.requested
  notification.push.requested
)

for TOPIC in "${TOPICS[@]}"; do
  rpk topic create "$TOPIC" --brokers localhost:9092 --partitions 3 --replication-factor 1
  rpk topic create "$TOPIC.dlq"   --brokers localhost:9092 --partitions 3 --replication-factor 1
done
```

---

## Listing Topics

```bash
rpk topic list --brokers localhost:9092
```

---

## Consuming Messages for Debugging

Consume all messages from the beginning of a topic (useful for debugging):

```bash
rpk topic consume <topic-name> \
  --brokers localhost:9092 \
  --offset start
```

**Example:**

```bash
rpk topic consume certification.decision.granted \
  --brokers localhost:9092 \
  --offset start
```

Press `Ctrl+C` to stop consuming.

---

## Consumer Groups

Consumer groups follow the convention `<module>-group`:

| Module | Consumer Group |
|--------|---------------|
| Cooperative | `cooperative-group` |
| Product | `product-group` |
| Certification | `certification-group` |
| Notification | `notification-group` |

**List all consumer groups:**

```bash
rpk group list --brokers localhost:9092
```

**Describe a consumer group (lag, offsets):**

```bash
rpk group describe notification-group --brokers localhost:9092
```

---

## Resetting a Consumer Group (Event Replay)

To replay all events in a topic from the beginning — for example after fixing a consumer bug:

```bash
rpk group seek <group-name> \
  --to start \
  --topics <topic-name> \
  --brokers localhost:9092
```

**Example — replay all certification granted events:**

```bash
rpk group seek notification-group \
  --to start \
  --topics certification.decision.granted \
  --brokers localhost:9092
```

> The consumer must be **stopped** before seeking its offsets. Restart it after the seek completes.

---

## DLQ Processing Workflow

When messages land in a DLQ:

1. **Inspect the DLQ** to understand the failure:

   ```bash
   rpk topic consume certification.decision.granted.dlq \
     --brokers localhost:9092 \
     --offset start
   ```

2. **Identify the root cause** — check application logs for the exception that triggered the DLQ routing.

3. **Fix the consumer bug** — update the code, open a pull request, and deploy.

4. **Replay DLQ messages** — once the fix is deployed, produce the DLQ messages back to the original topic manually or via a replay script.

   ```bash
   # Example: pipe DLQ messages back to the source topic
   rpk topic consume certification.decision.granted.dlq \
     --brokers localhost:9092 \
     --offset start \
     --format json \
   | rpk topic produce certification.decision.granted \
     --brokers localhost:9092
   ```

5. **Monitor consumer lag** to confirm all replayed messages are processed:

   ```bash
   rpk group describe notification-group --brokers localhost:9092
   ```
