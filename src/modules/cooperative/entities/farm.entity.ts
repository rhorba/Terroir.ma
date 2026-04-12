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

@Entity({ schema: 'cooperative', name: 'farm' })
export class Farm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @ManyToOne(() => Cooperative, (cooperative) => cooperative.farms)
  @JoinColumn({ name: 'cooperative_id' })
  cooperative: Cooperative;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'area_hectares' })
  areaHectares: number;

  @Column({ name: 'crop_types', type: 'jsonb', default: '[]' })
  cropTypes: string[];

  @Column({ name: 'region_code', length: 50 })
  regionCode: string;

  @Column({ name: 'commune', type: 'varchar', length: 100, nullable: true })
  commune: string | null;

  /** WKT: 'POINT(longitude latitude)' — PostGIS geography column */
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    name: 'location',
  })
  location: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
