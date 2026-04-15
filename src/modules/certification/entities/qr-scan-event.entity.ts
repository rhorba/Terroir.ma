import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Append-only log of every valid QR code scan.
 * Written fire-and-forget in QrCodeService.verifyQrCode() — never blocks response.
 * Schema: certification
 * US-058
 */
@Entity({ schema: 'certification', name: 'qr_scan_event' })
export class QrScanEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_qr_scan_event_qr_code_id')
  @Column({ name: 'qr_code_id', type: 'uuid' })
  qrCodeId: string;

  @Index('idx_qr_scan_event_certification_id')
  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  @Index('idx_qr_scan_event_scanned_at')
  @Column({
    name: 'scanned_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  scannedAt: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;
}
