import { Module } from '@nestjs/common';
import { EVENT_PUBLISHER } from './application/event-publisher.port';
import { RabbitMQEventPublisher } from './infrastructure/rabbitmq-event.publisher';

/**
 * Provides the AMQP-publishing adapter alone (no controllers, no outbox dependency)
 * so OutboxModule can consume it without forming a cycle with EventsModule.
 */
@Module({
  providers: [
    {
      provide: EVENT_PUBLISHER,
      useClass: RabbitMQEventPublisher,
    },
  ],
  exports: [EVENT_PUBLISHER],
})
export class EventsInfrastructureModule {}
