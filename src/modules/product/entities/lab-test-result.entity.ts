import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'product', name: 'lab_test_result' })
export class LabTestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lab_test_id', type: 'uuid' })
  labTestId: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'product_type_code', length: 50 })
  productTypeCode: string;

  @Column({ name: 'passed', type: 'boolean' })
  passed: boolean;

  /** Actual measured values — varies by product type (JSONB) */
  @Column({ name: 'test_values', type: 'jsonb' })
  testValues: Record<string, number | string>;

  /** Parameters that failed validation */
  @Column({ name: 'failed_parameters', type: 'jsonb', default: '[]' })
  failedParameters: string[];

  @Column({ name: 'technician_name', length: 200 })
  technicianName: string;

  @Column({ name: 'technician_id', type: 'uuid' })
  technicianId: string;

  @Column({ name: 'laboratory_name', length: 200, nullable: true })
  laboratoryName: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
