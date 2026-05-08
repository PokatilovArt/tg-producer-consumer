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
  OutboxRepository,
} from './outbox-repository.port';

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
      this.config.get<number>('OUTBOX_POLL_INTERVAL_MS', 1_000),
    );
    this.batchSize = Number(this.config.get<number>('OUTBOX_BATCH_SIZE', 50));
    this.maxAttempts = Number(
      this.config.get<number>('OUTBOX_MAX_ATTEMPTS', 10),
    );
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    // Let an in-flight tick finish
    while (this.running) {
      await new Promise((r) => setTimeout(r, 50));
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
            const message = (err as Error).message;
            const nextAttempt = record.attempts + 1;
            const giveUp = nextAttempt >= this.maxAttempts;
            const delay = giveUp
              ? 24 * 60 * 60 * 1_000 // park for a day; ops can re-queue manually
              : Math.min(60_000, 500 * 2 ** record.attempts);
            await ctx.markFailed(record.id, message, delay);
            this.logger[giveUp ? 'error' : 'warn'](
              {
                eventId: record.eventId,
                attempts: nextAttempt,
                err: message,
                giveUp,
              },
              'outbox publish failed',
            );
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
}
