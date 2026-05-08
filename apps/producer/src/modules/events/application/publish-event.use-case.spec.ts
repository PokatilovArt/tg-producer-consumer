import { NotificationEventType } from '@app/contracts';
import { EventPublisher } from './event-publisher.port';
import { PublishEventUseCase } from './publish-event.use-case';

describe('PublishEventUseCase', () => {
  const buildUseCase = (publisher: EventPublisher) => new PublishEventUseCase(publisher);

  it('publishes an envelope with a generated UUID and returns accepted status', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const useCase = buildUseCase({ publish });

    const result = await useCase.execute({
      type: NotificationEventType.TELEGRAM_MESSAGE,
      payload: { text: 'hello' },
    });

    expect(publish).toHaveBeenCalledTimes(1);
    const envelope = publish.mock.calls[0][0];
    expect(envelope.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(envelope.type).toBe(NotificationEventType.TELEGRAM_MESSAGE);
    expect(envelope.payload).toEqual({ text: 'hello' });
    expect(result.status).toBe('accepted');
    expect(result.eventId).toBe(envelope.eventId);
  });

  it('propagates publisher errors', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('boom'));
    const useCase = buildUseCase({ publish });

    await expect(
      useCase.execute({
        type: NotificationEventType.TELEGRAM_MESSAGE,
        payload: { text: 'x' },
      }),
    ).rejects.toThrow('boom');
  });
});
