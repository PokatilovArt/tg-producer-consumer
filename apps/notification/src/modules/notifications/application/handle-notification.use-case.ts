import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationEventEnvelope,
  NotificationEventType,
  TelegramMessagePayload,
} from '@app/contracts';
import { IDEMPOTENCY_STORE, IdempotencyStore } from './idempotency-store.port';
import { NOTIFICATION_SENDER, NotificationSender } from './notification-sender.port';

export class UnsupportedEventTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported event type: ${type}`);
  }
}

@Injectable()
export class HandleNotificationUseCase {
  private readonly logger = new Logger(HandleNotificationUseCase.name);

  constructor(
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  async execute(envelope: NotificationEventEnvelope): Promise<void> {
    if (envelope.type !== NotificationEventType.TELEGRAM_MESSAGE) {
      throw new UnsupportedEventTypeError(envelope.type);
    }

    const isFirst = await this.idempotency.registerOnce(envelope.eventId);
    if (!isFirst) {
      this.logger.log({ eventId: envelope.eventId }, 'duplicate event ignored');
      return;
    }

    try {
      await this.sender.send(envelope as NotificationEventEnvelope<TelegramMessagePayload>);
      this.logger.log(
        { eventId: envelope.eventId, type: envelope.type },
        'notification sent',
      );
    } catch (err) {
      this.logger.error(
        { eventId: envelope.eventId, err: (err as Error).message },
        'notification send failed',
      );
      throw err;
    }
  }
}
