import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Product supporting document uploaded to MinIO.
 * productId references product.product(id) via UUID only — no DB FK (module boundary safe).
 * US-017
 */
@Entity({ schema: 'product', name: 'product_document' })
export class ProductDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_product_document_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  /** MinIO object key: product-docs/{productId}/{uuid}-{sanitisedFileName} */
  @Column({ name: 's3_key', type: 'varchar', length: 500 })
  s3Key: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
