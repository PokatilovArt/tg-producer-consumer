import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import pRetry from 'p-retry';
import {
  HEADER_EVENT_ID,
  NotificationEventEnvelope,
} from '@app/contracts';
import { RABBITMQ_CONFIG, RabbitMQConnectionConfig } from '@app/rabbitmq';
import { EventPublisher } from '../application/event-publisher.port';

@Injectable()
export class RabbitMQEventPublisher implements EventPublisher {
  private readonly logger = new Logger(RabbitMQEventPublisher.name);

  constructor(
    private readonly amqp: AmqpConnection,
    @Inject(RABBITMQ_CONFIG) private readonly config: RabbitMQConnectionConfig,
  ) {}

  async publish(envelope: NotificationEventEnvelope): Promise<void> {
    await pRetry(
      async () => {
        const ok = await this.amqp.publish(
          this.config.exchange,
          this.config.routingKey,
          envelope,
          {
            persistent: true,
            messageId: envelope.eventId,
            contentType: 'application/json',
            headers: { [HEADER_EVENT_ID]: envelope.eventId },
          },
        );
        if (!ok) {
          throw new Error('publish returned false (broker buffer full or unconfirmed)');
        }
      },
      {
        retries: 4,
        minTimeout: 200,
        maxTimeout: 2_000,
        factor: 2,
        onFailedAttempt: (err) => {
          this.logger.warn(
            { eventId: envelope.eventId, attempt: err.attemptNumber, msg: err.message },
            'publish attempt failed, retrying',
          );
        },
      },
    );
  }
}
