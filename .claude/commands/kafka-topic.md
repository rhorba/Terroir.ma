# /kafka-topic

**Description:** List or create Redpanda/Kafka topics using rpk CLI.

**Arguments:** $ARGUMENTS = topic name to create, or empty to list all topics

**Steps:**
- If $ARGUMENTS is empty:
  1. Run `rpk topic list` (or `docker exec terroir-ma-redpanda-1 rpk topic list`)
  2. Display topics grouped by module (cooperative.*, product.*, lab.*, certification.*, verification.*, audit.*)
- If $ARGUMENTS is a topic name:
  1. Run `rpk topic create $ARGUMENTS --partitions 3 --replicas 1`
  2. Also create DLQ: `rpk topic create $ARGUMENTS.dlq --partitions 3 --replicas 1`
  3. Verify with: `rpk topic describe $ARGUMENTS`

**Example:** `/kafka-topic certification.decision.granted`

**Error Handling:**
- If Redpanda is not running: suggest `make docker-core`.
- If topic already exists: note it and skip (idempotent).
- If rpk is not found: use docker exec to access it inside the container.
