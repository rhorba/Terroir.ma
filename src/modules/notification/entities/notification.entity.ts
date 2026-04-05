import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type NotificationChannel = 'email' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

@Entity({ schema: 'notification', name: 'notification' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @Column({ name: 'recipient_email', length: 200, nullable: true })
  recipientEmail: string | null;

  @Column({ name: 'recipient_phone', length: 20, nullable: true })
  recipientPhone: string | null;

  @Column({ name: 'channel', type: 'varchar', length: 10 })
  channel: NotificationChannel;

  @Column({ name: 'template_code', length: 100 })
  templateCode: string;

  @Column({ name: 'language', length: 10, default: 'fr-MA' })
  language: string;

  @Column({ name: 'subject', length: 300, nullable: true })
  subject: string | null;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'context_data', type: 'jsonb', default: '{}' })
  contextData: Record<string, unknown>;

  @Column({ name: 'status', type: 'varchar', length: 10, default: 'pending' })
  status: NotificationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId: string | null;

  @Column({ name: 'trigger_event_id', type: 'uuid', nullable: true })
  triggerEventId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
