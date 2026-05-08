import * as Joi from 'joi';

export const producerEnvSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PRODUCER_PORT: Joi.number().integer().min(1).max(65535).default(3000),

  RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
  RABBITMQ_RETRY_TTL_MS: Joi.number().integer().min(1).default(10_000),
  RABBITMQ_MAX_RETRIES: Joi.number().integer().min(0).default(5),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(10),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(50).default(1_000),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).default(50),
  OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).default(10),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
}).unknown(true);

export const notificationEnvSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
  RABBITMQ_RETRY_TTL_MS: Joi.number().integer().min(1).default(10_000),
  RABBITMQ_MAX_RETRIES: Joi.number().integer().min(0).default(5),

  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  IDEMPOTENCY_TTL_SECONDS: Joi.number().integer().min(1).default(86_400),
  IDEMPOTENCY_PENDING_TTL_SECONDS: Joi.number().integer().min(1).default(60),

  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  TELEGRAM_CHAT_ID: Joi.string().required(),
  TELEGRAM_PARSE_MODE: Joi.string().valid('Markdown', 'MarkdownV2', 'HTML'),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
}).unknown(true);
