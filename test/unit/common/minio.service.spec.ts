import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from '../../../src/common/services/minio.service';

// Mock the entire @aws-sdk/client-s3 module
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({ Body: { pipe: jest.fn() } });
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    CreateBucketCommand: jest.fn(),
    HeadBucketCommand: jest.fn(),
    __mockSend: mockSend,
  };
});

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: unknown) => def),
          },
        },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uploadFile() — resolves without error', async () => {
    await expect(
      service.uploadFile('test/key.pdf', Buffer.from('data'), 'application/pdf'),
    ).resolves.toBeUndefined();
  });

  it('getFileStream() — returns the Body from S3 response', async () => {
    const stream = await service.getFileStream('test/key.pdf');
    expect(stream).toBeDefined();
  });
});
