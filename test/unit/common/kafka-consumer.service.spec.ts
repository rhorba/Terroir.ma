import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaConsumerService } from '../../../src/common/kafka/kafka-consumer.service';
import { SchemaRegistryService } from '../../../src/common/kafka/schema-registry.service';

let eachMessageCallback:
  | ((ctx: { topic: string; message: { value: Buffer | null } }) => Promise<void>)
  | null = null;

const mockConsumer = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockImplementation((opts: { eachMessage: typeof eachMessageCallback }) => {
    eachMessageCallback = opts.eachMessage;
    return Promise.resolve();
  }),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    consumer: jest.fn().mockReturnValue(mockConsumer),
  })),
}));

const mockSchemaRegistry = {
  decode: jest.fn().mockResolvedValue({ eventId: 'decoded-event' }),
};

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    eachMessageCallback = null;
    mockConsumer.connect.mockResolvedValue(undefined);
    mockConsumer.disconnect.mockResolvedValue(undefined);
    mockConsumer.subscribe.mockResolvedValue(undefined);
    mockConsumer.run.mockImplementation((opts: { eachMessage: typeof eachMessageCallback }) => {
      eachMessageCallback = opts.eachMessage;
      return Promise.resolve();
    });
    mockSchemaRegistry.decode.mockResolvedValue({ eventId: 'decoded-event' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaConsumerService,
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

    service = module.get<KafkaConsumerService>(KafkaConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe()', () => {
    it('stores the handler for the given topic', () => {
      const handler = jest.fn();
      service.subscribe('certification.decision.granted', handler);

      // startConsuming() should subscribe to this topic
      expect(service['handlers'].has('certification.decision.granted')).toBe(true);
    });
  });

  describe('startConsuming()', () => {
    it('does nothing if no handlers are registered', async () => {
      await service.startConsuming();
      expect(mockConsumer.connect).not.toHaveBeenCalled();
    });

    it('connects consumer and subscribes to all registered topics', async () => {
      service.subscribe('certification.decision.granted', jest.fn());
      service.subscribe('lab.test.completed', jest.fn());

      await service.startConsuming();

      expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'certification.decision.granted',
        fromBeginning: false,
      });
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'lab.test.completed',
        fromBeginning: false,
      });
    });

    it('decodes Avro message and dispatches to registered handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.subscribe('certification.decision.granted', handler);

      await service.startConsuming();

      await eachMessageCallback!({
        topic: 'certification.decision.granted',
        message: { value: Buffer.from('avro-bytes') },
      });

      expect(mockSchemaRegistry.decode).toHaveBeenCalledWith(Buffer.from('avro-bytes'));
      expect(handler).toHaveBeenCalledWith({ eventId: 'decoded-event' });
    });

    it('skips messages with null value', async () => {
      const handler = jest.fn();
      service.subscribe('certification.decision.granted', handler);

      await service.startConsuming();

      await eachMessageCallback!({
        topic: 'certification.decision.granted',
        message: { value: null },
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy()', () => {
    it('disconnects the consumer', async () => {
      await service.onModuleDestroy();
      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
