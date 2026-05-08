import { NotificationEventType } from '@app/contracts';
import {
  HandleNotificationUseCase,
  UnsupportedEventTypeError,
} from './handle-notification.use-case';
import { IdempotencyStore } from './idempotency-store.port';
import { NotificationSender } from './notification-sender.port';

describe('HandleNotificationUseCase', () => {
  const baseEnvelope = {
    eventId: '00000000-0000-4000-8000-000000000001',
    type: NotificationEventType.TELEGRAM_MESSAGE,
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload: { text: 'hi' },
  };

  const build = (
    sender: NotificationSender,
    store: IdempotencyStore,
  ) => new HandleNotificationUseCase(sender, store);

  it('sends the message on first delivery', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const registerOnce = jest.fn().mockResolvedValue(true);

    await build({ send }, { registerOnce }).execute(baseEnvelope);

    expect(registerOnce).toHaveBeenCalledWith(baseEnvelope.eventId);
    expect(send).toHaveBeenCalledWith(baseEnvelope);
  });

  it('skips duplicates without sending', async () => {
    const send = jest.fn();
    const registerOnce = jest.fn().mockResolvedValue(false);

    await build({ send }, { registerOnce }).execute(baseEnvelope);

    expect(send).not.toHaveBeenCalled();
  });

  it('rejects unsupported event types', async () => {
    const useCase = build(
      { send: jest.fn() },
      { registerOnce: jest.fn() },
    );

    await expect(
      useCase.execute({ ...baseEnvelope, type: 'unknown.type' as NotificationEventType }),
    ).rejects.toBeInstanceOf(UnsupportedEventTypeError);
  });

  it('propagates sender errors so the consumer can retry', async () => {
    const send = jest.fn().mockRejectedValue(new Error('telegram down'));
    const registerOnce = jest.fn().mockResolvedValue(true);

    await expect(
      build({ send }, { registerOnce }).execute(baseEnvelope),
    ).rejects.toThrow('telegram down');
  });
});
