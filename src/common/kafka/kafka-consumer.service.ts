import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { SchemaRegistryService } from './schema-registry.service';

type MessageHandler = (payload: unknown) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumer: Consumer;
  private readonly handlers = new Map<string, MessageHandler>();

  constructor(
    private readonly configService: ConfigService,
    private readonly schemaRegistry: SchemaRegistryService,
  ) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:19092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'terroir-ma');
    const kafka = new Kafka({ clientId, brokers });
    this.consumer = kafka.consumer({ groupId: 'notification-group' });
  }

  subscribe<T>(topic: string, handler: (payload: T) => Promise<void>): void {
    this.handlers.set(topic, handler as MessageHandler);
    this.logger.log({ topic }, 'Handler registered for topic');
  }

  async startConsuming(): Promise<void> {
    if (this.handlers.size === 0) return;

    await this.consumer.connect();

    for (const topic of this.handlers.keys()) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const handler = this.handlers.get(topic);
        if (!handler || !message.value) return;

        try {
          const payload = await this.schemaRegistry.decode(message.value);
          await handler(payload);
        } catch (error) {
          this.logger.error({ error, topic }, 'Failed to process Kafka message');
        }
      },
    });

    this.logger.log({ topics: [...this.handlers.keys()] }, 'Kafka consumer started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected');
  }
}
