import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  HEADER_ORIGINAL_ERROR,
  HEADER_RETRY_COUNT,
  NOTIFICATION_DEAD_ROUTING_KEY,
  NOTIFICATION_EXCHANGE,
  NOTIFICATION_QUEUE,
  NOTIFICATION_RETRY_ROUTING_KEY,
  NOTIFICATION_ROUTING_KEY,
  NotificationEventEnvelope,
} from '@app/contracts';
import { RABBITMQ_CONFIG, RabbitMQConnectionConfig } from '@app/rabbitmq';
import { HandleNotificationUseCase } from '../application/handle-notification.use-case';
import { PermanentNotificationError } from '../application/errors';

@Injectable()
export class NotificationConsumer {
  constructor(
    private readonly handler: HandleNotificationUseCase,
    private readonly amqp: AmqpConnection,
    @Inject(RABBITMQ_CONFIG) private readonly config: RabbitMQConnectionConfig,
    @InjectPinoLogger(NotificationConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  @RabbitSubscribe({
    exchange: NOTIFICATION_EXCHANGE,
    routingKey: NOTIFICATION_ROUTING_KEY,
    queue: NOTIFICATION_QUEUE,
  })
  async handle(
    envelope: NotificationEventEnvelope,
    rawMessage: ConsumeMessage,
  ): Promise<void> {
    const retryCount = this.readRetryCount(rawMessage);

    try {
      await this.handler.execute(envelope);
      this.logger.info(
        { eventId: envelope.eventId, attempt: retryCount },
        'notification handled',
      );
    } catch (err) {
      const error = err as Error;
      const nextAttempt = retryCount + 1;
      const permanent = err instanceof PermanentNotificationError;
      const exhausted = nextAttempt > this.config.maxRetries;

      if (permanent || exhausted) {
        this.logger.error(
          {
            eventId: envelope.eventId,
            attempts: nextAttempt,
            permanent,
            err: error.message,
          },
          'sending event to DLQ',
        );
        await this.amqp.publish(
          NOTIFICATION_EXCHANGE,
          NOTIFICATION_DEAD_ROUTING_KEY,
          envelope,
          {
            persistent: true,
            messageId: envelope.eventId,
            headers: {
              [HEADER_RETRY_COUNT]: nextAttempt,
              [HEADER_ORIGINAL_ERROR]: error.message.slice(0, 500),
            },
          },
        );
        return;
      }

      this.logger.warn(
        { eventId: envelope.eventId, attempt: nextAttempt, err: error.message },
        'handler failed, scheduling retry',
      );
      await this.amqp.publish(
        NOTIFICATION_EXCHANGE,
        NOTIFICATION_RETRY_ROUTING_KEY,
        envelope,
        {
          persistent: true,
          messageId: envelope.eventId,
          headers: { [HEADER_RETRY_COUNT]: nextAttempt },
        },
      );
    }
  }

  private readRetryCount(msg: ConsumeMessage): number {
    const headers = msg.properties.headers ?? {};
    const value = headers[HEADER_RETRY_COUNT];
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
