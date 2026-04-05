import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cooperative } from './cooperative.entity';

export type MemberRole = 'president' | 'secretary' | 'treasurer' | 'member';

@Entity({ schema: 'cooperative', name: 'member' })
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @ManyToOne(() => Cooperative, (cooperative) => cooperative.members)
  @JoinColumn({ name: 'cooperative_id' })
  cooperative: Cooperative;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ name: 'full_name_ar', length: 200, nullable: true })
  fullNameAr: string | null;

  @Column({ name: 'cin', length: 10, unique: true })
  cin: string;

  @Column({ name: 'phone', length: 20 })
  phone: string;

  @Column({ name: 'email', length: 100, nullable: true })
  email: string | null;

  @Column({ name: 'role', type: 'varchar', length: 20, default: 'member' })
  role: MemberRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'keycloak_user_id', type: 'uuid', nullable: true })
  keycloakUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
