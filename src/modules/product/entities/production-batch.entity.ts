import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export type BatchStatus =
  | 'created'
  | 'lab_testing'
  | 'lab_passed'
  | 'lab_failed'
  | 'certification_requested'
  | 'certified'
  | 'recalled';

@Entity({ schema: 'product', name: 'production_batch' })
export class ProductionBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_number', length: 50, unique: true })
  batchNumber: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'product_type_code', length: 50 })
  productTypeCode: string;

  @Column({ name: 'harvest_ids', type: 'jsonb', default: '[]' })
  harvestIds: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_quantity_kg' })
  totalQuantityKg: number;

  @Column({ name: 'processing_date', type: 'date' })
  processingDate: string;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'created' })
  status: BatchStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
