import { AmqpConnection, Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import {
  HEADER_RETRY_COUNT,
  NOTIFICATION_DLQ,
  NOTIFICATION_EXCHANGE,
  NOTIFICATION_QUEUE,
  NOTIFICATION_ROUTING_KEY,
  NotificationEventEnvelope,
} from '@app/contracts';
import { RABBITMQ_CONFIG, RabbitMQConnectionConfig } from '@app/rabbitmq';
import { HandleNotificationUseCase } from '../application/handle-notification.use-case';

@Injectable()
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly handler: HandleNotificationUseCase,
    private readonly amqp: AmqpConnection,
    @Inject(RABBITMQ_CONFIG) private readonly config: RabbitMQConnectionConfig,
  ) {}

  @RabbitSubscribe({
    exchange: NOTIFICATION_EXCHANGE,
    routingKey: NOTIFICATION_ROUTING_KEY,
    queue: NOTIFICATION_QUEUE,
    queueOptions: {
      durable: true,
      deadLetterExchange: NOTIFICATION_EXCHANGE,
      deadLetterRoutingKey: 'notification.retry',
    },
  })
  async handle(
    envelope: NotificationEventEnvelope,
    rawMessage: ConsumeMessage,
  ): Promise<Nack | undefined> {
    const retryCount = this.readRetryCount(rawMessage);

    try {
      await this.handler.execute(envelope);
      return undefined;
    } catch (err) {
      const nextAttempt = retryCount + 1;

      if (nextAttempt > this.config.maxRetries) {
        this.logger.error(
          { eventId: envelope.eventId, attempts: nextAttempt, err: (err as Error).message },
          'max retries exceeded, sending to DLQ',
        );
        await this.amqp.publish(NOTIFICATION_EXCHANGE, 'notification.dead', envelope, {
          persistent: true,
          headers: {
            [HEADER_RETRY_COUNT]: nextAttempt,
            'x-original-error': (err as Error).message.slice(0, 500),
          },
        });
        return new Nack(false);
      }

      this.logger.warn(
        { eventId: envelope.eventId, attempt: nextAttempt, err: (err as Error).message },
        'handler failed, scheduling retry',
      );
      // Republish into the retry queue with incremented counter; original is dropped.
      await this.amqp.publish(NOTIFICATION_EXCHANGE, 'notification.retry', envelope, {
        persistent: true,
        headers: { [HEADER_RETRY_COUNT]: nextAttempt },
        expiration: String(this.config.retryTtlMs),
      });
      return new Nack(false);
    }
  }

  private readRetryCount(msg: ConsumeMessage): number {
    const headers = msg.properties.headers ?? {};
    const value = headers[HEADER_RETRY_COUNT];
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  static readonly DLQ_NAME = NOTIFICATION_DLQ;
}
