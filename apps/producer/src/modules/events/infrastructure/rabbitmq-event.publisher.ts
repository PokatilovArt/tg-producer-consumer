import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import pRetry from 'p-retry';
import { HEADER_EVENT_ID, NotificationEventEnvelope } from '@app/contracts';
import { RABBITMQ_CONFIG, RabbitMQConnectionConfig } from '@app/rabbitmq';
import { EventPublisher } from '../application/event-publisher.port';

@Injectable()
export class RabbitMQEventPublisher implements EventPublisher {
  constructor(
    private readonly amqp: AmqpConnection,
    @Inject(RABBITMQ_CONFIG) private readonly config: RabbitMQConnectionConfig,
    @InjectPinoLogger(RabbitMQEventPublisher.name)
    private readonly logger: PinoLogger,
  ) {}

  async publish(envelope: NotificationEventEnvelope): Promise<void> {
    await pRetry(
      async () => {
        // amqp-connection-manager opens the channel in confirm mode (see RabbitMQModule),
        // so publish() awaits a broker ack and rejects on nack/disconnect.
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
          throw new Error('publish unconfirmed by broker');
        }
      },
      {
        retries: 4,
        minTimeout: 200,
        maxTimeout: 2_000,
        factor: 2,
        onFailedAttempt: (err) => {
          this.logger.warn(
            {
              eventId: envelope.eventId,
              attempt: err.attemptNumber,
              err: err.message,
            },
            'publish attempt failed, retrying',
          );
        },
      },
    );
  }
}
