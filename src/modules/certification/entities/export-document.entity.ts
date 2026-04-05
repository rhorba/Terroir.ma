import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExportDocumentStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired';

/**
 * Export document entity for ONSSA export certification (phytosanitary / COO).
 * Schema: certification
 */
@Entity({ schema: 'certification', name: 'export_document' })
export class ExportDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  /** ISO 3166-1 alpha-2 destination country code */
  @Column({ name: 'destination_country', length: 2 })
  destinationCountry: string;

  /** Harmonized System tariff code */
  @Column({ name: 'hs_code', length: 20 })
  hsCode: string;

  /** ONSSA reference number assigned upon submission */
  @Column({ name: 'onssa_reference', length: 50, nullable: true })
  onssaReference: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'quantity_kg' })
  quantityKg: number;

  @Column({ name: 'consignee_name', length: 200 })
  consigneeName: string;

  @Column({ name: 'consignee_country', length: 2 })
  consigneeCountry: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status: ExportDocumentStatus;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @Column({ name: 'document_url', length: 500, nullable: true })
  documentUrl: string | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
