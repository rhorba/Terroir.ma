import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { CertificationStatus, CertificationEventType } from './certification.entity';

/**
 * Append-only ledger of every state transition in the 12-step SDOQ certification chain.
 * NEVER update or delete rows — this table is the source of truth for the regulatory audit trail.
 * Law 25-06 requires a full immutable record of all certification decisions.
 * Schema: certification
 */
@Entity({ schema: 'certification', name: 'certification_events' })
export class CertificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The certification this event belongs to */
  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  /** The type of transition that occurred */
  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: CertificationEventType;

  /** Status before this transition */
  @Column({ name: 'from_status', type: 'varchar', length: 30 })
  fromStatus: CertificationStatus;

  /** Status after this transition */
  @Column({ name: 'to_status', type: 'varchar', length: 30 })
  toStatus: CertificationStatus;

  /** Keycloak user ID of the actor who triggered this transition */
  @Column({ name: 'actor_id', type: 'varchar', length: 50 })
  actorId: string;

  /** Keycloak role of the actor at the time of the transition */
  @Column({ name: 'actor_role', type: 'varchar', length: 50 })
  actorRole: string;

  /** DTO payload serialized — inspection details, lab IDs, remarks, etc. */
  @Column({ name: 'payload', type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  /**
   * Ties this DB event to its Kafka message / originating HTTP request for distributed tracing.
   * Also used as idempotency key — if a correlationId appears twice, the second is skipped.
   */
  @Column({ name: 'correlation_id', type: 'varchar', length: 50 })
  correlationId: string;

  /** Immutable timestamp — no @UpdateDateColumn or @DeleteDateColumn intentionally */
  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
