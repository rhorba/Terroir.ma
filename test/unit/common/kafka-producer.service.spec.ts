import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from '../../../src/common/kafka/kafka-producer.service';
import { SchemaRegistryService } from '../../../src/common/kafka/schema-registry.service';

const mockProducer = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: jest.fn().mockReturnValue(mockProducer),
  })),
}));

const mockSchemaRegistry = {
  encode: jest.fn().mockResolvedValue(Buffer.from('avro-bytes')),
};

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProducer.connect.mockResolvedValue(undefined);
    mockProducer.disconnect.mockResolvedValue(undefined);
    mockProducer.send.mockResolvedValue(undefined);
    mockSchemaRegistry.encode.mockResolvedValue(Buffer.from('avro-bytes'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaProducerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'KAFKA_BROKERS') return 'localhost:19092';
              if (key === 'KAFKA_CLIENT_ID') return 'terroir-ma';
              return undefined;
            }),
          },
        },
        { provide: SchemaRegistryService, useValue: mockSchemaRegistry },
      ],
    }).compile();

    service = module.get<KafkaProducerService>(KafkaProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit()', () => {
    it('connects the raw KafkaJS producer', async () => {
      await service.onModuleInit();
      expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy()', () => {
    it('disconnects the raw KafkaJS producer', async () => {
      await service.onModuleDestroy();
      expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('send()', () => {
    it('encodes payload via SchemaRegistryService using subject = topic + "-value"', async () => {
      const payload = { eventId: 'test-001', correlationId: 'corr-001' };

      await service.send('certification.decision.granted', payload);

      expect(mockSchemaRegistry.encode).toHaveBeenCalledWith(
        'certification.decision.granted-value',
        payload,
      );
    });

    it('sends the Avro-encoded Buffer to the correct topic', async () => {
      const payload = { eventId: 'test-001' };

      await service.send('certification.decision.granted', payload);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'certification.decision.granted',
        messages: [{ value: Buffer.from('avro-bytes') }],
      });
    });
  });
});
