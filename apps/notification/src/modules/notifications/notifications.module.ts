import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandleNotificationUseCase } from './application/handle-notification.use-case';
import { IDEMPOTENCY_STORE } from './application/idempotency-store.port';
import { NOTIFICATION_SENDER } from './application/notification-sender.port';
import { NotificationConsumer } from './interface/notification.consumer';
import {
  IDEMPOTENCY_CONFIG,
  IdempotencyConfig,
  RedisIdempotencyStore,
} from './infrastructure/redis-idempotency.store';
import { redisClientProvider } from './infrastructure/redis.provider';
import {
  TELEGRAM_CONFIG,
  TelegramConfig,
  TelegramNotificationSender,
} from './infrastructure/telegram-notification.sender';
import type { TelegramParseMode } from '@app/contracts';

@Module({
  imports: [ConfigModule],
  providers: [
    HandleNotificationUseCase,
    NotificationConsumer,
    redisClientProvider,
    {
      provide: IDEMPOTENCY_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): IdempotencyConfig => ({
        doneTtlSeconds: Number(
          config.get<number>('IDEMPOTENCY_TTL_SECONDS', 86_400),
        ),
        pendingTtlSeconds: Number(
          config.get<number>('IDEMPOTENCY_PENDING_TTL_SECONDS', 60),
        ),
      }),
    },
    {
      provide: IDEMPOTENCY_STORE,
      useClass: RedisIdempotencyStore,
    },
    {
      provide: TELEGRAM_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TelegramConfig => ({
        botToken: config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        defaultChatId: config.getOrThrow<string>('TELEGRAM_CHAT_ID'),
        defaultParseMode: config.get<TelegramParseMode>('TELEGRAM_PARSE_MODE'),
      }),
    },
    {
      provide: NOTIFICATION_SENDER,
      useClass: TelegramNotificationSender,
    },
  ],
})
export class NotificationsModule {}
