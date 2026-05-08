import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateNotificationEventDto,
  PublishedEventResponseDto,
} from '@app/contracts';
import { PublishEventUseCase } from '../application/publish-event.use-case';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly publishEvent: PublishEventUseCase) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Publish a notification event to RabbitMQ' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, type: PublishedEventResponseDto })
  async create(@Body() dto: CreateNotificationEventDto): Promise<PublishedEventResponseDto> {
    return this.publishEvent.execute(dto);
  }
}
