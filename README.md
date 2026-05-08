# FinSolutions — Nest.js Microservices (RabbitMQ + Telegram)

Two Nest.js microservices that communicate via RabbitMQ and deliver notifications to Telegram.

```
client ──HTTP──▶ producer ──SQL tx──▶ postgres (outbox)
                       └──relay (poll + SKIP LOCKED)──▶ rabbitmq ──▶ notification ──▶ Telegram Bot API
```

## Architecture

Nest monorepo with two apps and two shared libraries:

```
apps/
  producer/        REST API (POST /events) — publishes events to RabbitMQ
  notification/    Consumer — handles events, sends to Telegram
libs/
  contracts/       Shared DTOs, event types, queue/exchange names
  rabbitmq/        Shared RabbitMQ module (topology, config)
docker/            Dockerfiles for each service
docker-compose.yml RabbitMQ + Redis + producer + notification
```

Each service follows clean architecture:

```
modules/<feature>/
  domain/         (envelope types live in libs/contracts)
  application/    use-cases + ports (interfaces)
  infrastructure/ adapters (RabbitMQ publisher, Redis store, Telegram client)
  interface/      controllers / consumers
```

The `application` layer depends only on ports; concrete adapters are wired in the module.

### Event flow & reliability

- **Outbox.** `POST /events` writes into the `outbox` Postgres table and returns 202 immediately. A relay worker polls every `OUTBOX_POLL_INTERVAL_MS` with `SELECT … FOR UPDATE SKIP LOCKED LIMIT N` (so multiple producer replicas scale without double-publishing), publishes each row to RabbitMQ in confirm mode, and sets `published_at` in the same transaction. A producer crash between HTTP 202 and AMQP publish cannot lose events. Failed rows back off exponentially (capped at 60 s); after `OUTBOX_MAX_ATTEMPTS` they're parked for ops review.
- **Idempotency.** Producer assigns (or accepts a client-supplied) UUID v4 `eventId`. The outbox unique constraint on `event_id` makes `POST /events` itself idempotent: a retried HTTP request with the same `eventId` results in a single outbox row. Consumer additionally uses a two-state Redis mark (`acquire` → "pending" with short TTL; `commit` → "done" with long TTL; `release` on failure) so a crash mid-send doesn't silently swallow the redelivery.
- **Publisher reliability.** Channel runs in **publisher confirm** mode (`channels.default.confirm: true`); `amqp.publish` resolves only after a broker ack. Wrapped in `p-retry` with exponential backoff for transient errors.
- **Consumer retry.** Manual republish to `notifications.retry` (TTL = `RABBITMQ_RETRY_TTL_MS`) with incremented `x-retry-count`, then dead-letters back to the main queue. After `RABBITMQ_MAX_RETRIES` or on a `PermanentNotificationError` (e.g. Telegram 4xx), the event goes to `notifications.dlq`. The main queue itself has **no** DLX, so we never get the dual-copy problem.
- **Logging.** Structured JSON via `nestjs-pino` (`PinoLogger` everywhere). Every success/failure logs `eventId`, `type`, attempt number, error message.
- **Health.** Producer exposes `GET /health` (terminus + RabbitMQ + Postgres ping).
- **Config.** `ConfigModule` validates env at boot via Joi schemas — missing/invalid values fail fast.

### Topology

```
notifications.exchange (topic)
  ├── notifications.queue        ← notification.created      (DLX → notification.retry)
  ├── notifications.retry        ← notification.retry        (TTL → notification.created)
  └── notifications.dlq          ← notification.dead
```

## Running with Docker

1. Copy env template and fill in your Telegram bot token / chat id:
   ```bash
   cp .env.example .env
   # edit .env: TELEGRAM_BOT_TOKEN=..., TELEGRAM_CHAT_ID=...
   ```
2. Start the stack:
   ```bash
   docker compose up --build
   ```
3. Open:
   - Producer Swagger: http://localhost:3000/api
   - RabbitMQ management: http://localhost:15672 (guest/guest)

### Sending an event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "telegram.message",
    "payload": { "title": "Test", "text": "Hello from FinSolutions" }
  }'
```

Response `202 Accepted`:
```json
{ "eventId": "b6f1d2f3-...", "occurredAt": "2026-05-09T12:34:56.789Z", "status": "accepted" }
```

The notification service consumes the event and posts the message to your Telegram chat.

## Local development (without Docker)

```bash
npm install
docker compose up rabbitmq redis postgres    # infra only
cp .env.example .env                         # set RABBITMQ_URL=amqp://localhost:5672, REDIS_URL=redis://localhost:6379, DATABASE_URL=postgres://finsol:finsol@localhost:5432/finsol
npm run start:producer:dev                   # terminal 1
npm run start:notification:dev               # terminal 2
```

The outbox migration (`db/migrations/001_outbox.sql`) is auto-applied by Postgres on first
container start via `/docker-entrypoint-initdb.d`.

## Tests

```bash
npm test                # unit tests (use-cases)
npm run test:e2e        # producer REST e2e (publisher mocked)
npm run test:cov        # coverage report
```

## Environment variables

| Variable                  | Description                                   | Default                               |
|---------------------------|-----------------------------------------------|---------------------------------------|
| `PRODUCER_PORT`           | HTTP port for producer                        | `3000`                                |
| `DATABASE_URL`            | Postgres URI for outbox                       | —                                     |
| `DATABASE_POOL_MAX`       | pg pool size                                  | `10`                                  |
| `OUTBOX_POLL_INTERVAL_MS` | Relay poll period                             | `1000`                                |
| `OUTBOX_BATCH_SIZE`       | Rows claimed per tick                         | `50`                                  |
| `OUTBOX_MAX_ATTEMPTS`     | Relay attempts before parking                 | `10`                                  |
| `RABBITMQ_URL`            | AMQP connection URI                           | —                                     |
| `RABBITMQ_RETRY_TTL_MS`   | Retry queue TTL (ms) before redelivery        | `10000`                               |
| `RABBITMQ_MAX_RETRIES`    | Max attempts before DLQ                       | `5`                                   |
| `REDIS_URL`               | Redis URI for idempotency store               | —                                     |
| `IDEMPOTENCY_TTL_SECONDS` | TTL for `done` `eventId` keys                 | `86400`                               |
| `IDEMPOTENCY_PENDING_TTL_SECONDS` | TTL for `pending` tombstones (crash window) | `60`                          |
| `TELEGRAM_BOT_TOKEN`      | Bot token from @BotFather                     | —                                     |
| `TELEGRAM_CHAT_ID`        | Default chat id (overridable per event)       | —                                     |
| `TELEGRAM_PARSE_MODE`     | Optional: `Markdown` / `MarkdownV2` / `HTML`. Plain text if unset. | —                |
| `LOG_LEVEL`               | pino log level                                | `info`                                |

## Notes on design choices

- **Outbox** decouples HTTP acceptance from broker availability. The producer's transactional boundary is Postgres; RabbitMQ is just the delivery mechanism. This is the textbook way to guarantee "at-least-once delivery to the broker" without distributed transactions.
- **Polling + `FOR UPDATE SKIP LOCKED`** over LISTEN/NOTIFY: simpler, scales horizontally, recovers naturally after relay-worker downtime. Latency is bounded by `OUTBOX_POLL_INTERVAL_MS` (default 1 s).
- **Raw SQL via `pg`** (no ORM) — matches the project's stated Postgres direction.
- `@golevelup/nestjs-rabbitmq` over raw `@nestjs/microservices` — first-class topic exchanges, decorator-based subscribers, built-in connection management.
- Redis idempotency store keeps the consumer stateless and horizontally scalable.
- Per-message retry-counter header avoids relying on RabbitMQ's `x-death` array semantics, which differ between rejection and TTL expiry.
