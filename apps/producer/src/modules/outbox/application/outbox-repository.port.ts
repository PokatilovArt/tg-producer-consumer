import type { NotificationEventEnvelope } from '@app/contracts';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface OutboxRecord {
  id: string;
  eventId: string;
  envelope: NotificationEventEnvelope;
  attempts: number;
}

export interface OutboxRepository {
  /** Inserts an event idempotently by eventId. Returns false if a row already existed. */
  enqueue(envelope: NotificationEventEnvelope): Promise<boolean>;

  /**
   * Claims up to `limit` pending rows whose `next_attempt_at <= NOW()`,
   * locked with FOR UPDATE SKIP LOCKED so concurrent workers don't collide.
   * Caller MUST resolve each row via markPublished or markFailed within the same tx.
   */
  withClaimedBatch<T>(
    limit: number,
    handler: (records: OutboxRecord[], ctx: ClaimContext) => Promise<T>,
  ): Promise<T>;
}

export interface ClaimContext {
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string, retryDelayMs: number): Promise<void>;
}
