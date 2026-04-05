#!/usr/bin/env bash
# =============================================================================
# Terroir.ma — Redpanda Topic Creation Script
# Creates all 18 domain topics + their .dlq counterparts (36 topics total).
# Run from the repository root: bash infrastructure/scripts/redpanda-create-topics.sh
# =============================================================================
set -euo pipefail

echo "=== Creating Redpanda Topics ==="
BROKER="${KAFKA_BROKERS:-localhost:19092}"
echo "Broker: ${BROKER}"
echo ""

# Format: "topic-name:partitions:retention-ms"
# DLQ topics always get 1 partition and default retention
topics=(
  "cooperative.registration.submitted:3:604800000"
  "cooperative.registration.verified:3:604800000"
  "cooperative.farm.mapped:3:604800000"
  "product.harvest.logged:3:2592000000"
  "product.batch.created:3:2592000000"
  "lab.test.submitted:3:2592000000"
  "lab.test.completed:3:2592000000"
  "certification.request.submitted:3:31536000000"
  "certification.inspection.scheduled:3:31536000000"
  "certification.inspection.completed:3:31536000000"
  "certification.decision.granted:3:31536000000"
  "certification.decision.denied:3:31536000000"
  "certification.decision.revoked:3:31536000000"
  "certification.decision.renewed:3:31536000000"
  "verification.qr.generated:3:31536000000"
  "verification.qr.scanned:6:2592000000"
  "export.document.generated:3:31536000000"
  "audit.event.logged:6:31536000000"
)

created=0
skipped=0

for topic_def in "${topics[@]}"; do
  IFS=':' read -r topic_name partitions retention_ms <<< "$topic_def"

  echo "Creating topic: ${topic_name} (partitions: ${partitions}, retention: ${retention_ms}ms)"
  if rpk topic create "${topic_name}" \
    --brokers "${BROKER}" \
    --partitions "${partitions}" \
    --replicas 1 \
    --config "retention.ms=${retention_ms}" 2>&1; then
    created=$((created + 1))
  else
    echo "  -> Topic ${topic_name} may already exist, skipping."
    skipped=$((skipped + 1))
  fi

  # Create corresponding Dead Letter Queue topic
  dlq_topic="${topic_name}.dlq"
  echo "Creating DLQ:   ${dlq_topic} (partitions: 1)"
  if rpk topic create "${dlq_topic}" \
    --brokers "${BROKER}" \
    --partitions 1 \
    --replicas 1 \
    --config "retention.ms=${retention_ms}" 2>&1; then
    created=$((created + 1))
  else
    echo "  -> DLQ ${dlq_topic} may already exist, skipping."
    skipped=$((skipped + 1))
  fi

  echo ""
done

echo "─────────────────────────────────────────────"
echo "Topic creation summary:"
echo "  Created: ${created}"
echo "  Skipped: ${skipped}"
echo ""
echo "Verifying topics list..."
rpk topic list --brokers "${BROKER}"
echo ""
echo "=== Topic creation complete ==="
