/** Tuning for the AMQP publish retry loop (transient connection / unconfirmed publishes). */
export const PUBLISH_RETRY = {
  retries: 4,
  minTimeoutMs: 200,
  maxTimeoutMs: 2_000,
  backoffFactor: 2,
} as const;
