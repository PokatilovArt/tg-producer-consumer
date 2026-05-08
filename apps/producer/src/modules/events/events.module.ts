import { Module } from '@nestjs/common';
import { EventsController } from './interface/events.controller';
import { PublishEventUseCase } from './application/publish-event.use-case';
import { RabbitMQEventPublisher } from './infrastructure/rabbitmq-event.publisher';
import { EVENT_PUBLISHER } from './application/event-publisher.port';

@Module({
  controllers: [EventsController],
  providers: [
    PublishEventUseCase,
    {
      provide: EVENT_PUBLISHER,
      useClass: RabbitMQEventPublisher,
    },
  ],
})
export class EventsModule {}
