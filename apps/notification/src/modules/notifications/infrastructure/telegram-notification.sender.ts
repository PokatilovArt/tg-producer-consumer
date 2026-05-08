import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  NotificationEventEnvelope,
  TelegramMessagePayload,
  TelegramParseMode,
} from '@app/contracts';
import { NotificationSender } from '../application/notification-sender.port';
import { PermanentNotificationError } from '../application/errors';

export const TELEGRAM_CONFIG = Symbol('TELEGRAM_CONFIG');

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
  defaultParseMode?: TelegramParseMode;
}

@Injectable()
export class TelegramNotificationSender implements NotificationSender {
  private readonly http: AxiosInstance;

  constructor(
    @Inject(TELEGRAM_CONFIG) private readonly config: TelegramConfig,
    @InjectPinoLogger(TelegramNotificationSender.name)
    private readonly logger: PinoLogger,
  ) {
    this.http = axios.create({
      baseURL: `https://api.telegram.org/bot${config.botToken}`,
      timeout: 10_000,
    });
  }

  async send(
    envelope: NotificationEventEnvelope<TelegramMessagePayload>,
  ): Promise<void> {
    const { payload } = envelope;
    const chatId = payload.chatId ?? this.config.defaultChatId;
    const parseMode = payload.parseMode ?? this.config.defaultParseMode;
    const text = this.format(payload);

    try {
      await this.http.post('/sendMessage', {
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      });
    } catch (err) {
      throw this.classify(err, envelope.eventId);
    }
  }

  private format(payload: TelegramMessagePayload): string {
    return payload.title ? `${payload.title}\n${payload.text}` : payload.text;
  }

  private classify(err: unknown, eventId: string): Error {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<{ description?: string }>;
      const status = axiosErr.response?.status;
      const description =
        axiosErr.response?.data?.description ?? axiosErr.message;
      const message = `Telegram API error (${status ?? 'NETERR'}): ${description}`;

      this.logger.warn({ eventId, status, description }, 'telegram api error');

      // Retryable: network errors, 5xx, 429 rate limit.
      if (status === undefined || status >= 500 || status === 429) {
        return new Error(message);
      }
      // 4xx (other than 429) is a client/poison error — don't retry.
      return new PermanentNotificationError(message);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
