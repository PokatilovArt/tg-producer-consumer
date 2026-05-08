import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  NotificationEventEnvelope,
  NotificationEventType,
  TelegramMessagePayload,
} from '@app/contracts';
import { IDEMPOTENCY_STORE, IdempotencyStore } from './idempotency-store.port';
import { NOTIFICATION_SENDER, NotificationSender } from './notification-sender.port';
import { UnsupportedEventTypeError } from './errors';

@Injectable()
export class HandleNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @InjectPinoLogger(HandleNotificationUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(envelope: NotificationEventEnvelope): Promise<void> {
    if (envelope.type !== NotificationEventType.TELEGRAM_MESSAGE) {
      throw new UnsupportedEventTypeError(envelope.type);
    }

    const state = await this.idempotency.acquire(envelope.eventId);
    if (state === 'done') {
      this.logger.info(
        { eventId: envelope.eventId },
        'duplicate event ignored',
      );
      return;
    }

    try {
      await this.sender.send(envelope as NotificationEventEnvelope<TelegramMessagePayload>);
      await this.idempotency.commit(envelope.eventId);
      this.logger.info(
        { eventId: envelope.eventId, type: envelope.type },
        'notification sent',
      );
    } catch (err) {
      await this.idempotency.release(envelope.eventId);
      throw err;
    }
  }
}

export { UnsupportedEventTypeError };
