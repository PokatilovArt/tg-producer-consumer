/** Defaults applied when the corresponding env var is not set. */
export const RABBITMQ_DEFAULTS = {
  retryTtlMs: 10_000,
  maxRetries: 5,
  prefetchCount: 10,
  connectionInitTimeoutMs: 30_000,
} as const;
