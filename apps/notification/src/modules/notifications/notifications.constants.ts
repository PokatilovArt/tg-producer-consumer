export const IDEMPOTENCY_DEFAULTS = {
  doneTtlSeconds: 86_400,
  pendingTtlSeconds: 60,
} as const;

export const REDIS_CLIENT_DEFAULTS = {
  maxRetriesPerRequest: 3,
} as const;

export const TELEGRAM = {
  httpTimeoutMs: 10_000,
} as const;

/** HTTP status codes from the Telegram API that we treat as transient. */
export const TELEGRAM_RETRYABLE_STATUS = {
  rateLimited: 429,
  serverErrorMin: 500,
} as const;

/** Max chars from an error message stored in AMQP headers. */
export const ERROR_HEADER_MAX_LENGTH = 500;
