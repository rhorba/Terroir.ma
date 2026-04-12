import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'notification', name: 'notification_template' })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code', length: 100 })
  code: string; // e.g., certification-granted, lab-test-completed

  @Column({ name: 'channel', type: 'varchar', length: 10 })
  channel: string; // email | sms

  @Column({ name: 'language', length: 10 })
  language: string; // ar-MA | fr-MA | zgh

  @Column({ name: 'subject_template', type: 'varchar', length: 300, nullable: true })
  subjectTemplate: string | null;

  @Column({ name: 'body_template', type: 'text' })
  bodyTemplate: string; // Handlebars template

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
