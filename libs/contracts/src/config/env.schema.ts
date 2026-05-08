import * as Joi from 'joi';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const NODE_ENVS = ['development', 'production', 'test'] as const;

const PRODUCER_DEFAULT_PORT = 3000;
const RABBITMQ_DEFAULT_RETRY_TTL_MS = 10_000;
const RABBITMQ_DEFAULT_MAX_RETRIES = 5;
const DATABASE_DEFAULT_POOL_MAX = 10;
const OUTBOX_DEFAULT_POLL_INTERVAL_MS = 1_000;
const OUTBOX_MIN_POLL_INTERVAL_MS = 50;
const OUTBOX_DEFAULT_BATCH_SIZE = 50;
const OUTBOX_DEFAULT_MAX_ATTEMPTS = 10;
const IDEMPOTENCY_DEFAULT_TTL_SECONDS = 86_400;
const IDEMPOTENCY_DEFAULT_PENDING_TTL_SECONDS = 60;
const TCP_PORT_MAX = 65_535;

export const producerEnvSchema = Joi.object({
  NODE_ENV: Joi.string().valid(...NODE_ENVS).default('development'),
  PRODUCER_PORT: Joi.number()
    .integer()
    .min(1)
    .max(TCP_PORT_MAX)
    .default(PRODUCER_DEFAULT_PORT),

  RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
  RABBITMQ_RETRY_TTL_MS: Joi.number()
    .integer()
    .min(1)
    .default(RABBITMQ_DEFAULT_RETRY_TTL_MS),
  RABBITMQ_MAX_RETRIES: Joi.number()
    .integer()
    .min(0)
    .default(RABBITMQ_DEFAULT_MAX_RETRIES),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DATABASE_POOL_MAX: Joi.number()
    .integer()
    .min(1)
    .default(DATABASE_DEFAULT_POOL_MAX),
  OUTBOX_POLL_INTERVAL_MS: Joi.number()
    .integer()
    .min(OUTBOX_MIN_POLL_INTERVAL_MS)
    .default(OUTBOX_DEFAULT_POLL_INTERVAL_MS),
  OUTBOX_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .default(OUTBOX_DEFAULT_BATCH_SIZE),
  OUTBOX_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .default(OUTBOX_DEFAULT_MAX_ATTEMPTS),

  LOG_LEVEL: Joi.string().valid(...LOG_LEVELS).default('info'),
}).unknown(true);

export const notificationEnvSchema = Joi.object({
  NODE_ENV: Joi.string().valid(...NODE_ENVS).default('development'),

  RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
  RABBITMQ_RETRY_TTL_MS: Joi.number()
    .integer()
    .min(1)
    .default(RABBITMQ_DEFAULT_RETRY_TTL_MS),
  RABBITMQ_MAX_RETRIES: Joi.number()
    .integer()
    .min(0)
    .default(RABBITMQ_DEFAULT_MAX_RETRIES),

  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  IDEMPOTENCY_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(IDEMPOTENCY_DEFAULT_TTL_SECONDS),
  IDEMPOTENCY_PENDING_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(IDEMPOTENCY_DEFAULT_PENDING_TTL_SECONDS),

  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  TELEGRAM_CHAT_ID: Joi.string().required(),
  TELEGRAM_PARSE_MODE: Joi.string().valid('Markdown', 'MarkdownV2', 'HTML'),

  LOG_LEVEL: Joi.string().valid(...LOG_LEVELS).default('info'),
}).unknown(true);
