CREATE TABLE IF NOT EXISTS outbox (
  id           BIGSERIAL    PRIMARY KEY,
  event_id     UUID         NOT NULL UNIQUE,
  type         TEXT         NOT NULL,
  payload      JSONB        NOT NULL,
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts     INTEGER      NOT NULL DEFAULT 0,
  last_error   TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Hot index for the relay's claim query: only unpublished rows due for retry.
CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox (next_attempt_at)
  WHERE published_at IS NULL;
