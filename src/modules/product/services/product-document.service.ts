import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { ProductDocument } from '../entities/product-document.entity';
import { Product } from '../entities/product.entity';
import { MinioService } from '../../../common/services/minio.service';

/**
 * Product document service — uploads and retrieves supporting documents via MinIO.
 * US-017
 */
@Injectable()
export class ProductDocumentService {
  private readonly logger = new Logger(ProductDocumentService.name);

  constructor(
    @InjectRepository(ProductDocument)
    private readonly docRepo: Repository<ProductDocument>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Upload a supporting document for a product registration.
   * Key format: product-docs/{productId}/{uuid}-{sanitisedFileName}
   */
  async upload(
    productId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<ProductDocument> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Product ${productId} not found`,
      });
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `product-docs/${productId}/${uuidv4()}-${safeName}`;

    await this.minioService.uploadFile(s3Key, file.buffer, file.mimetype);

    const doc = this.docRepo.create({
      productId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      s3Key,
      sizeBytes: file.size,
      uploadedBy,
    });
    const saved = await this.docRepo.save(doc);
    this.logger.log({ docId: saved.id, productId }, 'Product document uploaded');
    return saved;
  }

  /** List all documents for a product, newest first. */
  async findByProduct(productId: string): Promise<ProductDocument[]> {
    return this.docRepo.find({ where: { productId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Stream a document from MinIO.
   * Returns the stream plus metadata for response headers.
   */
  async download(docId: string): Promise<{ stream: Readable; fileName: string; mimeType: string }> {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${docId} not found`,
      });
    }
    const stream = await this.minioService.getFileStream(doc.s3Key);
    return { stream, fileName: doc.fileName, mimeType: doc.mimeType };
  }
}
