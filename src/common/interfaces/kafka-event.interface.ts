/**
 * Base interface for all Terroir.ma Kafka events.
 * Every event in the certification chain extends this.
 */
export interface BaseEvent {
  /** UUID v4 — used for idempotent processing */
  eventId: string;
  /** Propagated across entire certification chain */
  correlationId: string;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
  /** Schema version — start at 1 */
  version: number;
  /** Which module produced this event */
  source: 'cooperative' | 'product' | 'certification' | 'notification';
}
