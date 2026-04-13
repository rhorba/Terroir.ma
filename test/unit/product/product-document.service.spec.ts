import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductDocumentService } from '../../../src/modules/product/services/product-document.service';
import { ProductDocument } from '../../../src/modules/product/entities/product-document.entity';
import { Product } from '../../../src/modules/product/entities/product.entity';
import { MinioService } from '../../../src/common/services/minio.service';

const makeRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const makeMinio = () => ({
  uploadFile: jest.fn().mockResolvedValue(undefined),
  getFileStream: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
});

describe('ProductDocumentService', () => {
  let service: ProductDocumentService;
  let docRepo: ReturnType<typeof makeRepo>;
  let productRepo: ReturnType<typeof makeRepo>;
  let minio: ReturnType<typeof makeMinio>;

  const mockFile = {
    originalname: 'sdoq-certificate.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('pdf-content'),
    size: 11,
  } as Express.Multer.File;

  beforeEach(async () => {
    docRepo = makeRepo();
    productRepo = makeRepo();
    minio = makeMinio();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductDocumentService,
        { provide: getRepositoryToken(ProductDocument), useValue: docRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: MinioService, useValue: minio },
      ],
    }).compile();

    service = module.get<ProductDocumentService>(ProductDocumentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── upload() ──────────────────────────────────────────────────────────────

  describe('upload()', () => {
    it('uploads to MinIO and saves ProductDocument record', async () => {
      const product = { id: 'prod-1' } as Product;
      const doc = {
        id: 'doc-1',
        productId: 'prod-1',
        fileName: 'sdoq-certificate.pdf',
      } as ProductDocument;

      productRepo.findOne.mockResolvedValue(product);
      docRepo.create.mockReturnValue(doc);
      docRepo.save.mockResolvedValue(doc);

      const result = await service.upload('prod-1', mockFile, 'user-1');

      expect(minio.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('product-docs/prod-1/'),
        mockFile.buffer,
        mockFile.mimetype,
      );
      expect(docRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          fileName: 'sdoq-certificate.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 11,
          uploadedBy: 'user-1',
        }),
      );
      expect(result).toEqual(doc);
    });

    it('throws NotFoundException when product does not exist', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(service.upload('missing-product', mockFile, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(minio.uploadFile).not.toHaveBeenCalled();
    });
  });

  // ─── findByProduct() ───────────────────────────────────────────────────────

  describe('findByProduct()', () => {
    it('returns all documents for a product ordered by createdAt DESC', async () => {
      const docs = [{ id: 'doc-2' }, { id: 'doc-1' }] as ProductDocument[];
      docRepo.find.mockResolvedValue(docs);

      const result = await service.findByProduct('prod-1');

      expect(docRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 'prod-1' } }),
      );
      expect(result).toEqual(docs);
    });

    it('returns empty array when no documents exist', async () => {
      docRepo.find.mockResolvedValue([]);
      const result = await service.findByProduct('prod-1');
      expect(result).toHaveLength(0);
    });
  });

  // ─── download() ────────────────────────────────────────────────────────────

  describe('download()', () => {
    it('returns stream, fileName and mimeType when document exists', async () => {
      const doc = {
        id: 'doc-1',
        s3Key: 'product-docs/prod-1/uuid-sdoq.pdf',
        fileName: 'sdoq-certificate.pdf',
        mimeType: 'application/pdf',
      } as ProductDocument;
      const mockStream = { pipe: jest.fn() };

      docRepo.findOne.mockResolvedValue(doc);
      minio.getFileStream.mockResolvedValue(mockStream);

      const result = await service.download('doc-1');

      expect(minio.getFileStream).toHaveBeenCalledWith('product-docs/prod-1/uuid-sdoq.pdf');
      expect(result.fileName).toBe('sdoq-certificate.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.stream).toBe(mockStream);
    });

    it('throws NotFoundException when document does not exist', async () => {
      docRepo.findOne.mockResolvedValue(null);

      await expect(service.download('missing-doc')).rejects.toThrow(NotFoundException);
      expect(minio.getFileStream).not.toHaveBeenCalled();
    });
  });
});
