import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateNotificationEventDto,
  NotificationEventEnvelope,
  PublishedEventResponseDto,
} from '@app/contracts';
import {
  OUTBOX_REPOSITORY,
  OutboxRepository,
} from '../../outbox/application/outbox-repository.port';

@Injectable()
export class PublishEventUseCase {
  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
    @InjectPinoLogger(PublishEventUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(dto: CreateNotificationEventDto): Promise<PublishedEventResponseDto> {
    const envelope: NotificationEventEnvelope = {
      eventId: dto.eventId ?? uuidv4(),
      type: dto.type,
      occurredAt: new Date().toISOString(),
      payload: dto.payload,
    };

    const enqueued = await this.outbox.enqueue(envelope);

    this.logger.info(
      {
        eventId: envelope.eventId,
        type: envelope.type,
        deduplicated: !enqueued,
      },
      enqueued ? 'event enqueued to outbox' : 'duplicate event ignored',
    );

    return {
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
      status: 'accepted',
    };
  }
}
