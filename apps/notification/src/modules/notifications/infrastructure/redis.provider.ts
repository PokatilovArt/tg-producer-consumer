import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT_DEFAULTS } from '../notifications.constants';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis =>
    new Redis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: REDIS_CLIENT_DEFAULTS.maxRetriesPerRequest,
      lazyConnect: false,
    }),
};
