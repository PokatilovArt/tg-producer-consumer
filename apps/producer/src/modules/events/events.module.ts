import { Module } from '@nestjs/common';
import { EventsController } from './interface/events.controller';
import { PublishEventUseCase } from './application/publish-event.use-case';

@Module({
  controllers: [EventsController],
  providers: [PublishEventUseCase],
})
export class EventsModule {}
