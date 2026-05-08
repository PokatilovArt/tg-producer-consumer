import {
  NOTIFICATION_DLQ,
  NOTIFICATION_EXCHANGE,
  NOTIFICATION_QUEUE,
  NOTIFICATION_RETRY_QUEUE,
  NOTIFICATION_RETRY_ROUTING_KEY,
  NOTIFICATION_ROUTING_KEY,
} from '@app/contracts';
import type { RabbitMQConnectionConfig } from './rabbitmq.config';

export interface ChannelLike {
  assertExchange(exchange: string, type: string, options?: object): Promise<unknown>;
  assertQueue(queue: string, options?: object): Promise<unknown>;
  bindQueue(queue: string, exchange: string, routingKey: string): Promise<unknown>;
  prefetch(count: number): Promise<void>;
}

export async function setupNotificationTopology(
  channel: ChannelLike,
  config: Pick<RabbitMQConnectionConfig, 'retryTtlMs'>,
): Promise<void> {
  await channel.assertExchange(NOTIFICATION_EXCHANGE, 'topic', { durable: true });

  await channel.assertQueue(NOTIFICATION_DLQ, { durable: true });
  await channel.bindQueue(NOTIFICATION_DLQ, NOTIFICATION_EXCHANGE, 'notification.dead');

  await channel.assertQueue(NOTIFICATION_QUEUE, {
    durable: true,
    deadLetterExchange: NOTIFICATION_EXCHANGE,
    deadLetterRoutingKey: NOTIFICATION_RETRY_ROUTING_KEY,
  });
  await channel.bindQueue(NOTIFICATION_QUEUE, NOTIFICATION_EXCHANGE, NOTIFICATION_ROUTING_KEY);

  await channel.assertQueue(NOTIFICATION_RETRY_QUEUE, {
    durable: true,
    messageTtl: config.retryTtlMs,
    deadLetterExchange: NOTIFICATION_EXCHANGE,
    deadLetterRoutingKey: NOTIFICATION_ROUTING_KEY,
  });
  await channel.bindQueue(
    NOTIFICATION_RETRY_QUEUE,
    NOTIFICATION_EXCHANGE,
    NOTIFICATION_RETRY_ROUTING_KEY,
  );
}
