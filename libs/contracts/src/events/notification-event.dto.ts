import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NotificationEventType } from './notification-event.contract';

export class TelegramMessagePayloadDto {
  @ApiPropertyOptional({
    description: 'Override default chat id from env. Optional.',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiPropertyOptional({
    description: 'Optional bold title prepended to the message.',
    example: 'Order created',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @ApiProperty({
    description: 'Message body sent to Telegram. Markdown supported.',
    example: 'New order *#1234* received from John',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}

export class CreateNotificationEventDto {
  @ApiProperty({
    enum: NotificationEventType,
    description: 'Event type used to route to the appropriate handler.',
  })
  @IsEnum(NotificationEventType)
  type!: NotificationEventType;

  @ApiProperty({ type: TelegramMessagePayloadDto })
  @ValidateNested()
  @Type(() => TelegramMessagePayloadDto)
  payload!: TelegramMessagePayloadDto;
}

export class PublishedEventResponseDto {
  @ApiProperty({ example: 'b6f1d2f3-2a30-4f4a-b2c0-7d4ec0e9b5f1' })
  eventId!: string;

  @ApiProperty({ example: '2026-05-09T12:34:56.789Z' })
  occurredAt!: string;

  @ApiProperty({ example: 'accepted' })
  status!: 'accepted';
}
