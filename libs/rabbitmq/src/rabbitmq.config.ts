export interface RabbitMQConnectionConfig {
  url: string;
  exchange: string;
  queue: string;
  routingKey: string;
  retryTtlMs: number;
  maxRetries: number;
}

export const RABBITMQ_CONFIG = Symbol('RABBITMQ_CONFIG');
