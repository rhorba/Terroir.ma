import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * US-090: Key-value store for platform-wide settings.
 * Schema: common. Composite PK: (setting_group, setting_key).
 * Grouped into 'campaign', 'certification', 'platform'.
 */
@Entity({ schema: 'common', name: 'system_setting' })
export class SystemSetting {
  @PrimaryColumn({ name: 'setting_group', type: 'varchar', length: 50 })
  settingGroup: string;

  @PrimaryColumn({ name: 'setting_key', type: 'varchar', length: 100 })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text' })
  settingValue: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
