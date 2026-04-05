import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * QR code entity for certification chain verification.
 * Each granted certification gets a unique HMAC-signed QR code.
 * Schema: certification
 */
@Entity({ schema: 'certification', name: 'qr_code' })
export class QrCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  /** HMAC-SHA256 signature of certificationId + issuedAt */
  @Column({ name: 'hmac_signature', length: 64 })
  hmacSignature: string;

  /** Public URL consumers scan to verify authenticity */
  @Column({ name: 'verification_url', length: 500 })
  verificationUrl: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Total number of times this QR code has been scanned */
  @Column({ name: 'scans_count', default: 0 })
  scansCount: number;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
