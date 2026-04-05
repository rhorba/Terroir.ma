import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

@Entity({ schema: 'certification', name: 'inspection' })
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'inspector_id', type: 'uuid' })
  inspectorId: string;

  @Column({ name: 'inspector_name', length: 200, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: string;

  @Column({ name: 'farm_ids', type: 'jsonb', default: '[]' })
  farmIds: string[];

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'scheduled' })
  status: InspectionStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'passed', type: 'boolean', nullable: true })
  passed: boolean | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;
}
