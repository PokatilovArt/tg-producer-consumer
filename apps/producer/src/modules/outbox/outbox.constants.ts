export const OUTBOX_DEFAULTS = {
  pollIntervalMs: 1_000,
  batchSize: 50,
  maxAttempts: 10,
  poolMax: 10,
  poolIdleTimeoutMs: 30_000,
} as const;

export const OUTBOX_BACKOFF = {
  /** First retry waits this long; doubles each attempt. */
  baseDelayMs: 500,
  /** Cap before parking the row. */
  maxDelayMs: 60_000,
  /** Park duration after attempts exhausted (24h). */
  parkDelayMs: 24 * 60 * 60 * 1_000,
} as const;

/** Max chars stored in `last_error` to keep rows small. */
export const OUTBOX_ERROR_MAX_LENGTH = 500;

/** Polling interval for the relay's drain-on-shutdown loop. */
export const RELAY_DRAIN_POLL_MS = 50;
