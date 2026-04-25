import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchemaRegistryService } from './schema-registry.service';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SchemaRegistryService, KafkaProducerService, KafkaConsumerService],
  exports: [SchemaRegistryService, KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
