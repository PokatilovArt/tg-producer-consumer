import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import pRetry from 'p-retry';
import { HEADER_EVENT_ID, NotificationEventEnvelope } from '@app/contracts';
import { RABBITMQ_CONFIG, RabbitMQConnectionConfig } from '@app/rabbitmq';
import { EventPublisher } from '../application/event-publisher.port';
import { PUBLISH_RETRY } from '../events.constants';

const JSON_CONTENT_TYPE = 'application/json';
const UNCONFIRMED_PUBLISH_ERROR = 'publish unconfirmed by broker';

@Injectable()
export class RabbitMQEventPublisher implements EventPublisher {
  constructor(
    private readonly amqp: AmqpConnection,
    @Inject(RABBITMQ_CONFIG) private readonly config: RabbitMQConnectionConfig,
    @InjectPinoLogger(RabbitMQEventPublisher.name)
    private readonly logger: PinoLogger,
  ) {}

  async publish(envelope: NotificationEventEnvelope): Promise<void> {
    await pRetry(() => this.publishOnce(envelope), {
      retries: PUBLISH_RETRY.retries,
      minTimeout: PUBLISH_RETRY.minTimeoutMs,
      maxTimeout: PUBLISH_RETRY.maxTimeoutMs,
      factor: PUBLISH_RETRY.backoffFactor,
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
    });
  }

  private async publishOnce(envelope: NotificationEventEnvelope): Promise<void> {
    // Channel is opened in confirm mode (see RabbitMQModule), so this awaits a broker ack.
    const ok = await this.amqp.publish(
      this.config.exchange,
      this.config.routingKey,
      envelope,
      {
        persistent: true,
        messageId: envelope.eventId,
        contentType: JSON_CONTENT_TYPE,
        headers: { [HEADER_EVENT_ID]: envelope.eventId },
      },
    );
    if (!ok) {
      throw new Error(UNCONFIRMED_PUBLISH_ERROR);
    }
  }
}
