---
name: kafka-integration
description: How to integrate Redpanda/Kafka in Terroir.ma. KafkaJS producers and consumers in NestJS, event TypeScript interfaces, topic naming, dead letter queues, idempotent processing, correlation ID propagation, testing with Testcontainers.
---

# Kafka Integration — Terroir.ma

## Topic Naming Convention
`<module>.<entity>.<action>`
Examples:
- `cooperative.registration.submitted`
- `certification.decision.granted`
- `verification.qr.scanned`

Each topic has a DLQ: `<topic>.dlq`

## Base Event Interface
```typescript
// src/common/interfaces/events/base.event.ts
export interface BaseEvent {
  eventId: string;       // UUID v4 — used for idempotency
  correlationId: string; // Propagated across entire chain
  timestamp: string;     // ISO 8601 UTC
  version: number;       // Start at 1
  source: 'cooperative' | 'product' | 'certification' | 'notification';
}
```

## Creating a Producer
```typescript
// src/modules/cooperative/events/cooperative.producer.ts
import { Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/core'; // adjust import
import { CooperativeRegistrationSubmittedEvent } from '@common/interfaces/events';

@Injectable()
export class CooperativeProducer {
  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async publishRegistrationSubmitted(event: CooperativeRegistrationSubmittedEvent): Promise<void> {
    await this.kafkaClient.emit('cooperative.registration.submitted', event).toPromise();
  }
}
```

## Creating a Consumer (Listener)
```typescript
// src/modules/notification/listeners/notification.listener.ts
@Controller()
export class NotificationListener {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('certification.decision.granted')
  async handleCertificationGranted(
    @Payload() data: CertificationGrantedEvent,
    @Ctx() context: KafkaContext,
  ) {
    // Idempotent: check if already processed
    if (await this.notificationService.isProcessed(data.eventId)) {
      context.getMessage().ack();
      return;
    }
    await this.notificationService.sendCertificationGrantedEmail(data);
    context.getMessage().ack();
  }
}
```

## Consumer Group Naming
`<module>-group` examples:
- `notification-group` (notification module consuming certification events)
- `certification-group` (certification module consuming lab events)

## Dead Letter Queue Pattern
```typescript
// On consumer error:
try {
  await this.processEvent(data);
} catch (err) {
  await this.kafkaClient.emit(`${topic}.dlq`, { ...data, error: err.message });
  this.logger.error({ eventId: data.eventId, error: err.message }, 'Event failed, sent to DLQ');
}
```

## Correlation ID Propagation
Always pass the correlationId from the incoming request through ALL Kafka events in the chain:
```typescript
// In HTTP request → extract from header or generate
const correlationId = request.headers['x-correlation-id'] ?? uuidv4();
// Pass to service → producer → event
const event = { ...eventData, correlationId };
```

## Testing Kafka with Testcontainers
```typescript
// test/integration/helpers/test-containers.setup.ts
import { RedpandaContainer } from '@testcontainers/redpanda';

let redpandaContainer: RedpandaContainer;

beforeAll(async () => {
  redpandaContainer = await new RedpandaContainer('docker.redpanda.com/redpandadata/redpanda:latest')
    .withExposedPorts(9092)
    .start();
  process.env.KAFKA_BROKERS = redpandaContainer.getBootstrapServers();
});

afterAll(async () => {
  await redpandaContainer.stop();
});
```

## Topic Creation with rpk
```bash
# Create topic with DLQ
rpk topic create certification.decision.granted --partitions 3 --replicas 1
rpk topic create certification.decision.granted.dlq --partitions 3 --replicas 1

# Consume messages (debug)
rpk topic consume certification.decision.granted --num 1
```
