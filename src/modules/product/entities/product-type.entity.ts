import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CertificationType } from '../../../common/interfaces/morocco.interface';

/** Defines a terroir product type with its lab test parameters (JSONB). */
@Entity({ schema: 'product', name: 'product_type' })
export class ProductType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g., ARGAN_OIL, SAFFRON_TALIOUINE */
  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ name: 'name_fr', length: 200 })
  nameFr: string;

  @Column({ name: 'name_ar', length: 200 })
  nameAr: string;

  @Column({ name: 'name_zgh', type: 'varchar', length: 200, nullable: true })
  nameZgh: string | null;

  @Column({ name: 'certification_type', type: 'varchar', length: 20 })
  certificationType: CertificationType;

  @Column({ name: 'region_code', length: 50 })
  regionCode: string;

  @Column({ name: 'lab_test_parameters', type: 'jsonb' })
  labTestParameters: Array<{
    name: string;
    unit: string;
    minValue?: number;
    maxValue?: number;
    type?: string;
    values?: string[];
  }>;

  @Column({ name: 'hs_code', type: 'varchar', length: 20, nullable: true })
  hsCode: string | null;

  @Column({ name: 'onssa_category', type: 'varchar', length: 50, nullable: true })
  onssaCategory: string | null;

  /** US-016 — soft deactivation flag. Inactive types are hidden from product creation. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** US-045 — Certificate validity period in days. null = no default configured. */
  @Column({ name: 'validity_days', type: 'int', nullable: true })
  validityDays: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
