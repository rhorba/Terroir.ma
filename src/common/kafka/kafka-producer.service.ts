import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { SchemaRegistryService } from './schema-registry.service';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;

  constructor(
    private readonly configService: ConfigService,
    private readonly schemaRegistry: SchemaRegistryService,
  ) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:19092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'terroir-ma');
    const kafka = new Kafka({ clientId, brokers });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
    this.logger.log('Kafka producer disconnected');
  }

  async send<T>(topic: string, payload: T): Promise<void> {
    const subject = `${topic}-value`;
    const value = await this.schemaRegistry.encode(subject, payload);
    await this.producer.send({ topic, messages: [{ value }] });
  }
}
