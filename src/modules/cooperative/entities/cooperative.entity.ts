import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Member } from './member.entity';
import { Farm } from './farm.entity';

export type CooperativeStatus = 'pending' | 'active' | 'suspended' | 'revoked';

/**
 * Represents a Moroccan agricultural cooperative.
 * Schema: cooperative
 */
@Entity({ schema: 'cooperative', name: 'cooperative' })
export class Cooperative {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'name_ar', type: 'varchar', length: 200, nullable: true })
  nameAr: string | null;

  /** Identifiant Commun de l'Entreprise — 15 digits */
  @Column({ name: 'ice', length: 15, unique: true })
  ice: string;

  /** Identifiant Fiscal */
  @Column({ name: 'if_number', type: 'varchar', length: 8, nullable: true })
  ifNumber: string | null;

  /** Registre de Commerce */
  @Column({ name: 'rc_number', type: 'varchar', length: 20, nullable: true })
  rcNumber: string | null;

  @Column({ length: 100 })
  email: string;

  /** +212XXXXXXXXX */
  @Column({ name: 'phone', length: 20 })
  phone: string;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'region_code', length: 50 })
  regionCode: string;

  @Column({ name: 'city', length: 100 })
  city: string;

  @Column({ name: 'president_name', length: 200 })
  presidentName: string;

  /** CIN format: 1-2 letters + 5-6 digits */
  @Column({ name: 'president_cin', length: 10 })
  presidentCin: string;

  @Column({ name: 'president_phone', length: 20 })
  presidentPhone: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: CooperativeStatus;

  /** Array of product type codes */
  @Column({ name: 'product_types', type: 'jsonb', default: '[]' })
  productTypes: string[];

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => Member, (member) => member.cooperative)
  members: Member[];

  @OneToMany(() => Farm, (farm) => farm.cooperative)
  farms: Farm[];
}
