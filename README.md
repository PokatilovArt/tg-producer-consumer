# FinSolutions — Nest.js Microservices (RabbitMQ + Telegram)

Two Nest.js microservices that communicate via RabbitMQ and deliver notifications to Telegram.

```
client ──HTTP──▶ producer ──AMQP──▶ rabbitmq ──AMQP──▶ notification ──HTTPS──▶ Telegram Bot API
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

- **Idempotency.** Producer assigns a UUID v4 `eventId` per event (also placed in the AMQP `messageId` and `x-event-id` header). Consumer uses Redis `SET NX EX` to ignore duplicates within a TTL window (default 24 h).
- **Publisher reliability.** `amqp-connection-manager` (via `@golevelup/nestjs-rabbitmq`) auto-reconnects; publish is wrapped in `p-retry` with exponential backoff for transient errors.
- **Consumer ack.** Manual ack: handler success ⇒ ack, failure ⇒ message republished to `notifications.retry` queue (TTL = `RABBITMQ_RETRY_TTL_MS`) with incremented `x-retry-count`, then dead-letters back into the main queue. After `RABBITMQ_MAX_RETRIES` attempts the event is sent to `notifications.dlq` for manual inspection.
- **Logging.** Structured JSON via `nestjs-pino`. Every success/failure logs `eventId`, `type`, attempt number, error message.

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
docker compose up rabbitmq redis            # infra only
cp .env.example .env                         # set RABBITMQ_URL=amqp://localhost:5672, REDIS_URL=redis://localhost:6379
npm run start:producer:dev                   # terminal 1
npm run start:notification:dev               # terminal 2
```

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
| `RABBITMQ_URL`            | AMQP connection URI                           | —                                     |
| `RABBITMQ_RETRY_TTL_MS`   | Retry queue TTL (ms) before redelivery        | `10000`                               |
| `RABBITMQ_MAX_RETRIES`    | Max attempts before DLQ                       | `5`                                   |
| `REDIS_URL`               | Redis URI for idempotency store               | —                                     |
| `IDEMPOTENCY_TTL_SECONDS` | TTL for processed `eventId` keys              | `86400`                               |
| `TELEGRAM_BOT_TOKEN`      | Bot token from @BotFather                     | —                                     |
| `TELEGRAM_CHAT_ID`        | Default chat id (overridable per event)       | —                                     |
| `LOG_LEVEL`               | pino log level                                | `info`                                |

## Notes on design choices

- `@golevelup/nestjs-rabbitmq` over raw `@nestjs/microservices` — first-class topic exchanges, decorator-based subscribers, built-in connection management.
- Redis idempotency store keeps the consumer stateless and horizontally scalable.
- Per-message retry-counter header avoids relying on RabbitMQ's `x-death` array semantics, which differ between rejection and TTL expiry.
