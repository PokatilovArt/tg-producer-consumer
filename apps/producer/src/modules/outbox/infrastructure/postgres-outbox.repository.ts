import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  NotificationEventEnvelope,
  NotificationEventType,
} from '@app/contracts';
import {
  ClaimContext,
  OutboxRecord,
  OutboxRepository,
} from '../application/outbox-repository.port';
import { PG_POOL } from './postgres.provider';

@Injectable()
export class PostgresOutboxRepository
  implements OutboxRepository, OnModuleDestroy
{
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async enqueue(envelope: NotificationEventEnvelope): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO outbox (event_id, type, payload, occurred_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [envelope.eventId, envelope.type, envelope.payload, envelope.occurredAt],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async withClaimedBatch<T>(
    limit: number,
    handler: (records: OutboxRecord[], ctx: ClaimContext) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{
        id: string;
        event_id: string;
        type: NotificationEventType;
        payload: unknown;
        occurred_at: Date;
        attempts: number;
      }>(
        `SELECT id, event_id, type, payload, occurred_at, attempts
         FROM outbox
         WHERE published_at IS NULL AND next_attempt_at <= NOW()
         ORDER BY id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [limit],
      );

      const records: OutboxRecord[] = rows.map((r) => ({
        id: r.id,
        eventId: r.event_id,
        attempts: r.attempts,
        envelope: {
          eventId: r.event_id,
          type: r.type,
          occurredAt: r.occurred_at.toISOString(),
          payload: r.payload,
        },
      }));

      const ctx = this.buildContext(client);
      const result = await handler(records, ctx);

      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private buildContext(client: PoolClient): ClaimContext {
    return {
      markPublished: async (id: string): Promise<void> => {
        await client.query(
          `UPDATE outbox
           SET published_at = NOW(), last_error = NULL
           WHERE id = $1`,
          [id],
        );
      },
      markFailed: async (
        id: string,
        error: string,
        retryDelayMs: number,
      ): Promise<void> => {
        await client.query(
          `UPDATE outbox
           SET attempts = attempts + 1,
               last_error = $2,
               next_attempt_at = NOW() + ($3::int || ' milliseconds')::interval
           WHERE id = $1`,
          [id, error.slice(0, 500), retryDelayMs],
        );
      },
    };
  }
}
