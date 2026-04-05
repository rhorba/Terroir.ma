import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'product', name: 'harvest' })
export class Harvest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'product_type_code', length: 50 })
  productTypeCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'quantity_kg' })
  quantityKg: number;

  @Column({ name: 'harvest_date', type: 'date' })
  harvestDate: string;

  /** e.g., 2025/2026 */
  @Column({ name: 'campaign_year', length: 10 })
  campaignYear: string;

  @Column({ name: 'method', length: 100 })
  method: string;

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
