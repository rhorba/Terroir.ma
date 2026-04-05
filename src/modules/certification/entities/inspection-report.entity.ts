import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'certification', name: 'inspection_report' })
export class InspectionReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inspection_id', type: 'uuid', unique: true })
  inspectionId: string;

  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'inspector_id', type: 'uuid' })
  inspectorId: string;

  @Column({ name: 'passed', type: 'boolean' })
  passed: boolean;

  @Column({ name: 'summary', type: 'text' })
  summary: string;

  /** Detailed findings per farm (JSONB) */
  @Column({ name: 'farm_findings', type: 'jsonb', default: '[]' })
  farmFindings: Array<{
    farmId: string;
    findings: string;
    passed: boolean;
    photos?: string[];
  }>;

  /** Non-conformities requiring corrective action */
  @Column({ name: 'non_conformities', type: 'jsonb', default: '[]' })
  nonConformities: Array<{
    code: string;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    corrective_action?: string;
  }>;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
