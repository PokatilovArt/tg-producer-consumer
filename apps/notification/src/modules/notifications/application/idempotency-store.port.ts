export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export type IdempotencyState = 'fresh' | 'pending' | 'done';

export interface IdempotencyStore {
  /**
   * Atomically transitions a key from absent to "pending".
   * Returns 'fresh' on first acquisition, otherwise the current state.
   */
  acquire(key: string): Promise<IdempotencyState>;

  /** Marks the key as permanently processed. */
  commit(key: string): Promise<void>;

  /** Releases a "pending" tombstone so the next delivery can retry. */
  release(key: string): Promise<void>;
}
