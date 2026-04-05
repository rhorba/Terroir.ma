import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LabTestStatus = 'submitted' | 'in_progress' | 'completed' | 'cancelled';

@Entity({ schema: 'product', name: 'lab_test' })
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'product_type_code', length: 50 })
  productTypeCode: string;

  @Column({ name: 'laboratory_id', type: 'uuid', nullable: true })
  laboratoryId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'submitted' })
  status: LabTestStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'expected_result_date', type: 'date', nullable: true })
  expectedResultDate: string | null;

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
