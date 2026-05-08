export const NOTIFICATION_EXCHANGE = 'notifications.exchange';
export const NOTIFICATION_QUEUE = 'notifications.queue';
export const NOTIFICATION_RETRY_QUEUE = 'notifications.retry';
export const NOTIFICATION_DLQ = 'notifications.dlq';
export const NOTIFICATION_ROUTING_KEY = 'notification.created';
export const NOTIFICATION_RETRY_ROUTING_KEY = 'notification.retry';
export const NOTIFICATION_DEAD_ROUTING_KEY = 'notification.dead';

export const HEADER_EVENT_ID = 'x-event-id';
export const HEADER_RETRY_COUNT = 'x-retry-count';
export const HEADER_ORIGINAL_ERROR = 'x-original-error';

export enum NotificationEventType {
  TELEGRAM_MESSAGE = 'telegram.message',
}

export type TelegramParseMode = 'Markdown' | 'MarkdownV2' | 'HTML';

export interface NotificationEventEnvelope<TPayload = unknown> {
  eventId: string;
  type: NotificationEventType;
  occurredAt: string;
  payload: TPayload;
}

export interface TelegramMessagePayload {
  chatId?: string;
  title?: string;
  text: string;
  parseMode?: TelegramParseMode;
}
