import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lab entity — ONSSA-accredited laboratory registry.
 * Accreditation is metadata only in v1; enforcement on lab-test submission deferred to Phase 2.
 * US-030
 */
@Entity({ schema: 'product', name: 'lab' })
export class Lab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'onssa_accreditation_number', type: 'varchar', length: 50, nullable: true })
  onssaAccreditationNumber: string | null;

  @Column({ name: 'is_accredited', type: 'boolean', default: false })
  isAccredited: boolean;

  @Column({ name: 'accredited_at', type: 'timestamptz', nullable: true })
  accreditedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
