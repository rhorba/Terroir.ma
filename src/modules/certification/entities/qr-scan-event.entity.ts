import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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

  @Column({ name: 'qr_code_id', type: 'uuid' })
  qrCodeId: string;

  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  @Column({
    name: 'scanned_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  scannedAt: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;
}
