import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EVENT_PUBLISHER, EventPublisher } from '../../events/application/event-publisher.port';
import {
  OUTBOX_REPOSITORY,
  OutboxRecord,
  OutboxRepository,
} from './outbox-repository.port';
import {
  OUTBOX_BACKOFF,
  OUTBOX_DEFAULTS,
  RELAY_DRAIN_POLL_MS,
} from '../outbox.constants';

@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly repo: OutboxRepository,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    private readonly config: ConfigService,
    @InjectPinoLogger(OutboxRelayWorker.name)
    private readonly logger: PinoLogger,
  ) {
    this.intervalMs = Number(
      this.config.get<number>(
        'OUTBOX_POLL_INTERVAL_MS',
        OUTBOX_DEFAULTS.pollIntervalMs,
      ),
    );
    this.batchSize = Number(
      this.config.get<number>('OUTBOX_BATCH_SIZE', OUTBOX_DEFAULTS.batchSize),
    );
    this.maxAttempts = Number(
      this.config.get<number>(
        'OUTBOX_MAX_ATTEMPTS',
        OUTBOX_DEFAULTS.maxAttempts,
      ),
    );
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    while (this.running) {
      await new Promise((r) => setTimeout(r, RELAY_DRAIN_POLL_MS));
    }
  }

  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.repo.withClaimedBatch(this.batchSize, async (records, ctx) => {
        for (const record of records) {
          try {
            await this.publisher.publish(record.envelope);
            await ctx.markPublished(record.id);
            this.logger.info(
              { eventId: record.eventId, attempts: record.attempts + 1 },
              'outbox row published',
            );
          } catch (err) {
            await this.handleFailure(record, err as Error, ctx);
          }
        }
      });
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message },
        'outbox relay tick failed',
      );
    } finally {
      this.running = false;
    }
  }

  private async handleFailure(
    record: OutboxRecord,
    err: Error,
    ctx: { markFailed: (id: string, err: string, delayMs: number) => Promise<void> },
  ): Promise<void> {
    const nextAttempt = record.attempts + 1;
    const giveUp = nextAttempt >= this.maxAttempts;
    const delay = giveUp
      ? OUTBOX_BACKOFF.parkDelayMs
      : Math.min(
          OUTBOX_BACKOFF.maxDelayMs,
          OUTBOX_BACKOFF.baseDelayMs * 2 ** record.attempts,
        );
    await ctx.markFailed(record.id, err.message, delay);
    this.logger[giveUp ? 'error' : 'warn'](
      {
        eventId: record.eventId,
        attempts: nextAttempt,
        err: err.message,
        giveUp,
      },
      'outbox publish failed',
    );
  }
}
