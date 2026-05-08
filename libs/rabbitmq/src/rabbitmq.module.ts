import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  NOTIFICATION_DEAD_ROUTING_KEY,
  NOTIFICATION_DLQ,
  NOTIFICATION_EXCHANGE,
  NOTIFICATION_QUEUE,
  NOTIFICATION_RETRY_QUEUE,
  NOTIFICATION_RETRY_ROUTING_KEY,
  NOTIFICATION_ROUTING_KEY,
} from '@app/contracts';
import { RABBITMQ_CONFIG, RabbitMQConnectionConfig } from './rabbitmq.config';

interface RabbitMQModuleOptions {
  enableConsumer?: boolean;
}

@Module({})
export class RabbitMQModule {
  static forRoot(options: RabbitMQModuleOptions = {}): DynamicModule {
    return {
      module: RabbitMQModule,
      imports: [
        GolevelupRabbitMQModule.forRootAsync(GolevelupRabbitMQModule, {
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const retryTtlMs = Number(
              config.get<number>('RABBITMQ_RETRY_TTL_MS', 10_000),
            );
            return {
              uri: config.getOrThrow<string>('RABBITMQ_URL'),
              connectionInitOptions: { wait: true, timeout: 30_000 },
              enableControllerDiscovery: options.enableConsumer ?? false,
              exchanges: [
                { name: NOTIFICATION_EXCHANGE, type: 'topic', options: { durable: true } },
              ],
              queues: [
                {
                  name: NOTIFICATION_QUEUE,
                  exchange: NOTIFICATION_EXCHANGE,
                  routingKey: NOTIFICATION_ROUTING_KEY,
                  createQueueIfNotExists: true,
                  options: { durable: true },
                },
                {
                  name: NOTIFICATION_RETRY_QUEUE,
                  exchange: NOTIFICATION_EXCHANGE,
                  routingKey: NOTIFICATION_RETRY_ROUTING_KEY,
                  createQueueIfNotExists: true,
                  options: {
                    durable: true,
                    messageTtl: retryTtlMs,
                    deadLetterExchange: NOTIFICATION_EXCHANGE,
                    deadLetterRoutingKey: NOTIFICATION_ROUTING_KEY,
                  },
                },
                {
                  name: NOTIFICATION_DLQ,
                  exchange: NOTIFICATION_EXCHANGE,
                  routingKey: NOTIFICATION_DEAD_ROUTING_KEY,
                  createQueueIfNotExists: true,
                  options: { durable: true },
                },
              ],
              channels: {
                default: { prefetchCount: 10, default: true, confirm: true },
              },
            };
          },
        }),
      ],
      providers: [
        {
          provide: RABBITMQ_CONFIG,
          inject: [ConfigService],
          useFactory: (config: ConfigService): RabbitMQConnectionConfig => ({
            url: config.getOrThrow<string>('RABBITMQ_URL'),
            exchange: NOTIFICATION_EXCHANGE,
            queue: NOTIFICATION_QUEUE,
            routingKey: NOTIFICATION_ROUTING_KEY,
            retryTtlMs: Number(config.get<number>('RABBITMQ_RETRY_TTL_MS', 10_000)),
            maxRetries: Number(config.get<number>('RABBITMQ_MAX_RETRIES', 5)),
          }),
        },
      ],
      exports: [GolevelupRabbitMQModule, RABBITMQ_CONFIG],
      global: true,
    };
  }
}
