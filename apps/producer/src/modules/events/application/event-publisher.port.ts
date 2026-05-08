import type { NotificationEventEnvelope } from '@app/contracts';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export interface EventPublisher {
  publish(envelope: NotificationEventEnvelope): Promise<void>;
}
