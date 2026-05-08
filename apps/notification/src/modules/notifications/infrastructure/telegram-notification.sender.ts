import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  NotificationEventEnvelope,
  TelegramMessagePayload,
} from '@app/contracts';
import { NotificationSender } from '../application/notification-sender.port';

export const TELEGRAM_CONFIG = Symbol('TELEGRAM_CONFIG');

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
}

@Injectable()
export class TelegramNotificationSender implements NotificationSender {
  private readonly logger = new Logger(TelegramNotificationSender.name);
  private readonly http: AxiosInstance;

  constructor(@Inject(TELEGRAM_CONFIG) private readonly config: TelegramConfig) {
    this.http = axios.create({
      baseURL: `https://api.telegram.org/bot${config.botToken}`,
      timeout: 10_000,
    });
  }

  async send(
    envelope: NotificationEventEnvelope<TelegramMessagePayload>,
  ): Promise<void> {
    const { payload } = envelope;
    const text = this.format(payload);
    const chatId = payload.chatId ?? this.config.defaultChatId;

    try {
      await this.http.post('/sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? `${err.response?.status ?? 'NETERR'}: ${JSON.stringify(err.response?.data) ?? err.message}`
        : (err as Error).message;
      this.logger.warn({ eventId: envelope.eventId, message }, 'telegram api error');
      throw new Error(`Telegram API error: ${message}`);
    }
  }

  private format(payload: TelegramMessagePayload): string {
    return payload.title ? `*${payload.title}*\n${payload.text}` : payload.text;
  }
}
