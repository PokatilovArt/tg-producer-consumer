import { ConfigService } from '@nestjs/config';
import { OutboxRelayWorker } from './outbox-relay.worker';
import {
  ClaimContext,
  OutboxRecord,
  OutboxRepository,
} from './outbox-repository.port';
import { EventPublisher } from '../../events/application/event-publisher.port';
import { NotificationEventType } from '@app/contracts';

const noopLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as import('nestjs-pino').PinoLogger;

describe('OutboxRelayWorker', () => {
  const config = {
    get: (key: string, def: unknown) => def,
  } as unknown as ConfigService;

  const record = (id: string, attempts = 0): OutboxRecord => ({
    id,
    eventId: id,
    attempts,
    envelope: {
      eventId: id,
      type: NotificationEventType.TELEGRAM_MESSAGE,
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload: { text: 'x' },
    },
  });

  const buildCtx = (): jest.Mocked<ClaimContext> => ({
    markPublished: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  });

  it('marks rows as published when the publisher succeeds', async () => {
    const ctx = buildCtx();
    const repo: OutboxRepository = {
      enqueue: jest.fn(),
      withClaimedBatch: async (_limit, handler) =>
        handler([record('1'), record('2')], ctx),
    };
    const publisher: EventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const worker = new OutboxRelayWorker(repo, publisher, config, noopLogger);
    await worker.tick();

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(ctx.markPublished).toHaveBeenCalledTimes(2);
    expect(ctx.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed with backoff when publish throws, parking after max attempts', async () => {
    const ctx = buildCtx();
    const repo: OutboxRepository = {
      enqueue: jest.fn(),
      withClaimedBatch: async (_limit, handler) =>
        handler([record('1', 0), record('2', 9)], ctx),
    };
    const publisher: EventPublisher = {
      publish: jest.fn().mockRejectedValue(new Error('amqp down')),
    };
    const cfg = {
      get: (key: string, def: unknown) =>
        key === 'OUTBOX_MAX_ATTEMPTS' ? 10 : def,
    } as unknown as ConfigService;

    const worker = new OutboxRelayWorker(repo, publisher, cfg, noopLogger);
    await worker.tick();

    expect(ctx.markFailed).toHaveBeenCalledTimes(2);
    const firstCallDelay = (ctx.markFailed.mock.calls[0] as unknown[])[2] as number;
    const lastCallDelay = (ctx.markFailed.mock.calls[1] as unknown[])[2] as number;
    expect(firstCallDelay).toBeLessThan(60_001);
    expect(lastCallDelay).toBeGreaterThan(60_000); // parked
  });
});
