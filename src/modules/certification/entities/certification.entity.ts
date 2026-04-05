import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { CertificationType } from '../../../common/interfaces/morocco.interface';

export type CertificationStatus =
  | 'pending'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'granted'
  | 'denied'
  | 'revoked'
  | 'expired'
  | 'renewed';

/**
 * Certification entity — represents an official terroir product certification.
 * Certification number format: TERROIR-{IGP|AOP|LA}-{REGION}-{YEAR}-{SEQ}
 * Schema: certification
 */
@Entity({ schema: 'certification', name: 'certification' })
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Human-readable certification number.
   * Format: TERROIR-{IGP|AOP|LA}-{REGION_CODE}-{YEAR}-{SEQ6}
   * Example: TERROIR-IGP-SOUSS_MASSA-2025-000042
   */
  @Column({ name: 'certification_number', length: 80, unique: true, nullable: true })
  certificationNumber: string | null;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'cooperative_name', length: 200 })
  cooperativeName: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'product_type_code', length: 50 })
  productTypeCode: string;

  @Column({ name: 'certification_type', type: 'varchar', length: 20 })
  certificationType: CertificationType;

  @Column({ name: 'region_code', length: 50 })
  regionCode: string;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'pending' })
  status: CertificationStatus;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy: string | null;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: true })
  grantedAt: Date | null;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @Column({ name: 'denied_by', type: 'uuid', nullable: true })
  deniedBy: string | null;

  @Column({ name: 'denied_at', type: 'timestamptz', nullable: true })
  deniedAt: Date | null;

  @Column({ name: 'denial_reason', type: 'text', nullable: true })
  denialReason: string | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason: string | null;

  @Column({ name: 'renewed_from_id', type: 'uuid', nullable: true })
  renewedFromId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
