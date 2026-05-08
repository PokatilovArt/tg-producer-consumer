import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateNotificationEventDto,
  NotificationEventEnvelope,
  PublishedEventResponseDto,
} from '@app/contracts';
import { EVENT_PUBLISHER, EventPublisher } from './event-publisher.port';

@Injectable()
export class PublishEventUseCase {
  private readonly logger = new Logger(PublishEventUseCase.name);

  constructor(@Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher) {}

  async execute(dto: CreateNotificationEventDto): Promise<PublishedEventResponseDto> {
    const envelope: NotificationEventEnvelope = {
      eventId: uuidv4(),
      type: dto.type,
      occurredAt: new Date().toISOString(),
      payload: dto.payload,
    };

    await this.publisher.publish(envelope);

    this.logger.log({ eventId: envelope.eventId, type: envelope.type }, 'event published');

    return {
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
      status: 'accepted',
    };
  }
}
