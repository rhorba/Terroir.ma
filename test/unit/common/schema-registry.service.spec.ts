import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchemaRegistryService } from '../../../src/common/kafka/schema-registry.service';

const mockRegistryInstance = {
  register: jest.fn().mockResolvedValue({ id: 42 }),
  encode: jest.fn().mockResolvedValue(Buffer.from('avro-encoded')),
  decode: jest.fn().mockResolvedValue({ eventId: 'test-event-id' }),
};

jest.mock('@kafkajs/confluent-schema-registry', () => ({
  SchemaRegistry: jest.fn().mockImplementation(() => mockRegistryInstance),
  SchemaType: { AVRO: 'AVRO' },
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn().mockReturnValue(['certification.decision.granted.avsc']),
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      type: 'record',
      name: 'CertificationDecisionGranted',
      namespace: 'ma.terroir.test',
      fields: [{ name: 'eventId', type: 'string' }],
    }),
  ),
}));

const mockFetch = jest.fn().mockResolvedValue({ ok: true } as Response);
global.fetch = mockFetch;

describe('SchemaRegistryService', () => {
  let service: SchemaRegistryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRegistryInstance.register.mockResolvedValue({ id: 42 });
    mockRegistryInstance.encode.mockResolvedValue(Buffer.from('avro-encoded'));
    mockRegistryInstance.decode.mockResolvedValue({ eventId: 'test-event-id' });
    mockFetch.mockResolvedValue({ ok: true } as Response);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemaRegistryService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:8081') },
        },
      ],
    }).compile();

    service = module.get<SchemaRegistryService>(SchemaRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerAll()', () => {
    it('registers schemas from avsc files and caches schema IDs', async () => {
      await service.registerAll();

      expect(mockRegistryInstance.register).toHaveBeenCalledTimes(1);
      expect(mockRegistryInstance.register).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'AVRO' }),
        expect.objectContaining({ subject: 'certification.decision.granted-value' }),
      );
    });

    it('is idempotent — second call skips registration', async () => {
      await service.registerAll();
      await service.registerAll();

      expect(mockRegistryInstance.register).toHaveBeenCalledTimes(1);
    });

    it('sets BACKWARD compatibility per subject before registering', async () => {
      await service.registerAll();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8081/config/certification.decision.granted-value',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ compatibility: 'BACKWARD' }),
        }),
      );
    });
  });

  describe('encode()', () => {
    it('encodes payload and returns a Buffer after registerAll()', async () => {
      await service.registerAll();
      const result = await service.encode('certification.decision.granted-value', {
        eventId: 'test',
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(mockRegistryInstance.encode).toHaveBeenCalledWith(42, { eventId: 'test' });
    });

    it('throws if subject not registered', async () => {
      await expect(service.encode('unknown-topic-value', {})).rejects.toThrow(
        'No schema registered for subject "unknown-topic-value"',
      );
    });
  });

  describe('decode()', () => {
    it('decodes a Buffer and returns the typed payload', async () => {
      const result = await service.decode<{ eventId: string }>(Buffer.from('avro-bytes'));

      expect(result.eventId).toBe('test-event-id');
      expect(mockRegistryInstance.decode).toHaveBeenCalledWith(Buffer.from('avro-bytes'));
    });
  });
});
