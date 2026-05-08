import { NotificationEventType } from '@app/contracts';
import { HandleNotificationUseCase } from './handle-notification.use-case';
import { UnsupportedEventTypeError } from './errors';
import { IdempotencyState, IdempotencyStore } from './idempotency-store.port';
import { NotificationSender } from './notification-sender.port';

const noopLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
} as unknown as import('nestjs-pino').PinoLogger;

describe('HandleNotificationUseCase', () => {
  const baseEnvelope = {
    eventId: '00000000-0000-4000-8000-000000000001',
    type: NotificationEventType.TELEGRAM_MESSAGE,
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload: { text: 'hi' },
  };

  const build = (sender: NotificationSender, store: IdempotencyStore) =>
    new HandleNotificationUseCase(sender, store, noopLogger);

  const buildStore = (state: IdempotencyState): IdempotencyStore => ({
    acquire: jest.fn().mockResolvedValue(state),
    commit: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  });

  it('sends and commits on first delivery', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const store = buildStore('fresh');

    await build({ send }, store).execute(baseEnvelope);

    expect(send).toHaveBeenCalledWith(baseEnvelope);
    expect(store.commit).toHaveBeenCalledWith(baseEnvelope.eventId);
    expect(store.release).not.toHaveBeenCalled();
  });

  it('skips when already done', async () => {
    const send = jest.fn();
    const store = buildStore('done');

    await build({ send }, store).execute(baseEnvelope);

    expect(send).not.toHaveBeenCalled();
    expect(store.commit).not.toHaveBeenCalled();
  });

  it('releases pending mark on send failure so retry can pick up', async () => {
    const send = jest.fn().mockRejectedValue(new Error('telegram down'));
    const store = buildStore('fresh');

    await expect(build({ send }, store).execute(baseEnvelope)).rejects.toThrow(
      'telegram down',
    );
    expect(store.release).toHaveBeenCalledWith(baseEnvelope.eventId);
    expect(store.commit).not.toHaveBeenCalled();
  });

  it('rejects unsupported event types', async () => {
    const useCase = build({ send: jest.fn() }, buildStore('fresh'));

    await expect(
      useCase.execute({
        ...baseEnvelope,
        type: 'unknown.type' as NotificationEventType,
      }),
    ).rejects.toBeInstanceOf(UnsupportedEventTypeError);
  });
});
