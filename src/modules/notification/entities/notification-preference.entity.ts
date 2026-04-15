import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * US-077: Per-user notification channel and language preferences.
 * Schema: notification. Keyed by Keycloak sub (userId).
 * GET returns defaults if no row exists — never 404.
 */
@Entity({ schema: 'notification', name: 'notification_preference' })
export class NotificationPreference {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text', array: true, default: '{email}' })
  channels: string[];

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  language: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
