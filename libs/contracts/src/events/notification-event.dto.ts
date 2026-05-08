import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NotificationEventType, TelegramParseMode } from './notification-event.contract';

const PARSE_MODES: TelegramParseMode[] = ['Markdown', 'MarkdownV2', 'HTML'];

export class TelegramMessagePayloadDto {
  @ApiPropertyOptional({
    description: 'Override default chat id from env. Optional.',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiPropertyOptional({ description: 'Optional title prepended to the message.' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @ApiProperty({
    description: 'Message body sent to Telegram.',
    example: 'New order #1234 received from John',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;

  @ApiPropertyOptional({
    description: 'Telegram parse mode. Omit for plain text (default).',
    enum: PARSE_MODES,
  })
  @IsOptional()
  @IsIn(PARSE_MODES)
  parseMode?: TelegramParseMode;
}

export class CreateNotificationEventDto {
  @ApiPropertyOptional({
    description:
      'Optional client-supplied UUID for end-to-end idempotency. Generated if absent.',
    example: 'b6f1d2f3-2a30-4f4a-b2c0-7d4ec0e9b5f1',
  })
  @IsOptional()
  @IsUUID(4)
  eventId?: string;

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
