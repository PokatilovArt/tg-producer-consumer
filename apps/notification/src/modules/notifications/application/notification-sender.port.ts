import type { NotificationEventEnvelope, TelegramMessagePayload } from '@app/contracts';

export const NOTIFICATION_SENDER = Symbol('NOTIFICATION_SENDER');

export interface NotificationSender {
  send(envelope: NotificationEventEnvelope<TelegramMessagePayload>): Promise<void>;
}
