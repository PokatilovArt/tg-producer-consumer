import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import {
  IdempotencyState,
  IdempotencyStore,
} from '../application/idempotency-store.port';
import { REDIS_CLIENT } from './redis.provider';

export interface IdempotencyConfig {
  doneTtlSeconds: number;
  pendingTtlSeconds: number;
}

export const IDEMPOTENCY_CONFIG = Symbol('IDEMPOTENCY_CONFIG');

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore, OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(IDEMPOTENCY_CONFIG) private readonly config: IdempotencyConfig,
    @InjectPinoLogger(RedisIdempotencyStore.name)
    private readonly logger: PinoLogger,
  ) {
    this.redis.on('error', (err) =>
      this.logger.error({ err: err.message }, 'redis error'),
    );
  }

  async acquire(key: string): Promise<IdempotencyState> {
    const result = await this.redis.set(
      this.redisKey(key),
      'pending',
      'EX',
      this.config.pendingTtlSeconds,
      'NX',
    );
    if (result === 'OK') return 'fresh';

    const current = await this.redis.get(this.redisKey(key));
    return current === 'done' ? 'done' : 'pending';
  }

  async commit(key: string): Promise<void> {
    await this.redis.set(
      this.redisKey(key),
      'done',
      'EX',
      this.config.doneTtlSeconds,
    );
  }

  async release(key: string): Promise<void> {
    await this.redis.del(this.redisKey(key));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
      await this.redis.quit();
    }
  }

  private redisKey(key: string): string {
    return `idem:${key}`;
  }
}
