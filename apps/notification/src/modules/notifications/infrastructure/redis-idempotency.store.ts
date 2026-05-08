import { Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { IdempotencyStore } from '../application/idempotency-store.port';

export class RedisIdempotencyStore implements IdempotencyStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisIdempotencyStore.name);
  private readonly redis: Redis;

  constructor(
    redisUrl: string,
    private readonly ttlSeconds: number,
  ) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.redis.on('error', (err) => this.logger.error(err.message, 'redis error'));
  }

  async registerOnce(key: string): Promise<boolean> {
    const result = await this.redis.set(`idem:${key}`, '1', 'EX', this.ttlSeconds, 'NX');
    return result === 'OK';
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
