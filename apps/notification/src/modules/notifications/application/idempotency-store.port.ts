export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export interface IdempotencyStore {
  /** Returns true if the key was registered for the first time. */
  registerOnce(key: string): Promise<boolean>;
}
