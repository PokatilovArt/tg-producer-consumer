import { NotificationEventType } from '@app/contracts';
import { PublishEventUseCase } from './publish-event.use-case';
import { OutboxRepository } from '../../outbox/application/outbox-repository.port';

const noopLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as import('nestjs-pino').PinoLogger;

describe('PublishEventUseCase', () => {
  const buildUseCase = (outbox: OutboxRepository) =>
    new PublishEventUseCase(outbox, noopLogger);

  const stubRepo = (enqueue: jest.Mock): OutboxRepository => ({
    enqueue,
    withClaimedBatch: jest.fn(),
  });

  it('enqueues a fresh envelope and returns accepted', async () => {
    const enqueue = jest.fn().mockResolvedValue(true);
    const useCase = buildUseCase(stubRepo(enqueue));

    const result = await useCase.execute({
      type: NotificationEventType.TELEGRAM_MESSAGE,
      payload: { text: 'hello' },
    });

    const envelope = enqueue.mock.calls[0][0];
    expect(envelope.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.eventId).toBe(envelope.eventId);
    expect(result.status).toBe('accepted');
  });

  it('preserves a client-supplied eventId for end-to-end idempotency', async () => {
    const enqueue = jest.fn().mockResolvedValue(true);
    const useCase = buildUseCase(stubRepo(enqueue));

    const clientId = '11111111-1111-4111-8111-111111111111';
    const result = await useCase.execute({
      eventId: clientId,
      type: NotificationEventType.TELEGRAM_MESSAGE,
      payload: { text: 'x' },
    });

    expect(result.eventId).toBe(clientId);
    expect(enqueue.mock.calls[0][0].eventId).toBe(clientId);
  });

  it('still returns accepted when the row already existed (duplicate request)', async () => {
    const enqueue = jest.fn().mockResolvedValue(false);
    const useCase = buildUseCase(stubRepo(enqueue));

    const result = await useCase.execute({
      eventId: '11111111-1111-4111-8111-111111111111',
      type: NotificationEventType.TELEGRAM_MESSAGE,
      payload: { text: 'x' },
    });

    expect(result.status).toBe('accepted');
  });
});
