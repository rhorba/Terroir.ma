import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ProcessingStepType {
  SORTING = 'SORTING',
  WASHING = 'WASHING',
  PRESSING = 'PRESSING',
  DRYING = 'DRYING',
  PACKAGING = 'PACKAGING',
  STORAGE = 'STORAGE',
  TRANSPORT = 'TRANSPORT',
  OTHER = 'OTHER',
}

/**
 * Records an immutable post-harvest processing step for a production batch.
 * Append-only — no updatedAt (mirrors CertificationEvent pattern).
 * Schema: product. US-019.
 */
@Entity({ schema: 'product', name: 'processing_step' })
export class ProcessingStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'step_type', type: 'varchar', length: 30 })
  stepType: ProcessingStepType;

  @Column({ name: 'done_at', type: 'timestamptz' })
  doneAt: Date;

  @Column({ name: 'done_by', type: 'uuid' })
  doneBy: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
