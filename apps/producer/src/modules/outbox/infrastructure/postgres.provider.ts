import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const PG_POOL = Symbol('PG_POOL');

export const pgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Pool =>
    new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: Number(config.get<number>('DATABASE_POOL_MAX', 10)),
      idleTimeoutMillis: 30_000,
    }),
};
