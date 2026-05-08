import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandleNotificationUseCase } from './application/handle-notification.use-case';
import { IDEMPOTENCY_STORE } from './application/idempotency-store.port';
import { NOTIFICATION_SENDER } from './application/notification-sender.port';
import { NotificationConsumer } from './interface/notification.consumer';
import { RedisIdempotencyStore } from './infrastructure/redis-idempotency.store';
import {
  TELEGRAM_CONFIG,
  TelegramConfig,
  TelegramNotificationSender,
} from './infrastructure/telegram-notification.sender';

@Module({
  imports: [ConfigModule],
  providers: [
    HandleNotificationUseCase,
    NotificationConsumer,
    {
      provide: IDEMPOTENCY_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new RedisIdempotencyStore(
          config.getOrThrow<string>('REDIS_URL'),
          Number(config.get<number>('IDEMPOTENCY_TTL_SECONDS', 86_400)),
        ),
    },
    {
      provide: TELEGRAM_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TelegramConfig => ({
        botToken: config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        defaultChatId: config.getOrThrow<string>('TELEGRAM_CHAT_ID'),
      }),
    },
    {
      provide: NOTIFICATION_SENDER,
      useClass: TelegramNotificationSender,
    },
  ],
})
export class NotificationsModule {}
