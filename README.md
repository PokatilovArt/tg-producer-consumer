# FinSolutions — микросервисы на Nest.js (RabbitMQ + Telegram)

Два микросервиса на Nest.js, обменивающихся сообщениями через RabbitMQ и доставляющих уведомления в Telegram.

```
client ──HTTP──▶ producer ──SQL tx──▶ postgres (outbox)
                       └──relay (poll + SKIP LOCKED)──▶ rabbitmq ──▶ notification ──▶ Telegram Bot API
```

## Архитектура

Nest-монорепозиторий с двумя приложениями и двумя общими библиотеками:

```
apps/
  producer/        REST API (POST /events) — публикует события в RabbitMQ
  notification/    Consumer — обрабатывает события, отправляет в Telegram
libs/
  contracts/       Общие DTO, типы событий, имена очередей и обменников
  rabbitmq/        Общий RabbitMQ-модуль (топология, конфиг)
docker/            Dockerfile для каждого сервиса
docker-compose.yml RabbitMQ + Redis + producer + notification
```

Каждый сервис построен по принципам чистой архитектуры:

```
modules/<feature>/
  domain/         (типы конвертов лежат в libs/contracts)
  application/    use-cases + порты (интерфейсы)
  infrastructure/ адаптеры (RabbitMQ-publisher, Redis-store, Telegram-клиент)
  interface/      контроллеры / consumers
```

Слой `application` зависит только от портов; конкретные адаптеры подключаются в модуле.

### Поток событий и надёжность

- **Outbox.** `POST /events` записывает данные в таблицу `outbox` в Postgres и сразу возвращает 202. Воркер-relay опрашивает её каждые `OUTBOX_POLL_INTERVAL_MS` запросом `SELECT … FOR UPDATE SKIP LOCKED LIMIT N` (что позволяет нескольким репликам producer'а масштабироваться без двойной публикации), публикует каждую строку в RabbitMQ в режиме confirm и проставляет `published_at` в той же транзакции. Падение producer'а между HTTP 202 и публикацией в AMQP не приводит к потере событий. Неудачные строки откатываются с экспоненциальной задержкой (с верхней границей 60 с); после `OUTBOX_MAX_ATTEMPTS` они «паркуются» для разбора оператором.
- **Идемпотентность.** Producer назначает (или принимает от клиента) UUID v4 `eventId`. Уникальное ограничение по `event_id` в outbox делает сам `POST /events` идемпотентным: повторный HTTP-запрос с тем же `eventId` создаёт ровно одну строку в outbox. Дополнительно consumer использует двухстатусную метку в Redis (`acquire` → "pending" с коротким TTL; `commit` → "done" с длинным TTL; `release` при ошибке), чтобы падение посреди отправки не привело к молчаливому проглатыванию повторной доставки.
- **Надёжность publisher'а.** Канал работает в режиме **publisher confirm** (`channels.default.confirm: true`); `amqp.publish` резолвится только после ack от брокера. Обёрнут в `p-retry` с экспоненциальным backoff'ом для временных ошибок.
- **Retry на consumer'е.** Ручная переотправка в `notifications.retry` (TTL = `RABBITMQ_RETRY_TTL_MS`) с инкрементом `x-retry-count`, после чего сообщение через dead-letter возвращается в основную очередь. После `RABBITMQ_MAX_RETRIES` или при `PermanentNotificationError` (например, 4xx от Telegram) событие уходит в `notifications.dlq`. У основной очереди **нет** DLX — это исключает проблему дублирующейся доставки.
- **Логирование.** Структурированные JSON-логи через `nestjs-pino` (`PinoLogger` повсюду). Каждый успех/ошибка пишет `eventId`, `type`, номер попытки, текст ошибки.
- **Health.** Producer отдаёт `GET /health` (terminus + ping RabbitMQ + Postgres).
- **Конфиг.** `ConfigModule` валидирует переменные окружения на старте через Joi-схемы — отсутствующие/невалидные значения падают сразу.

### Топология

```
notifications.exchange (topic)
  ├── notifications.queue        ← notification.created      (DLX → notification.retry)
  ├── notifications.retry        ← notification.retry        (TTL → notification.created)
  └── notifications.dlq          ← notification.dead
```

## Запуск через Docker

1. Скопируйте шаблон env-файла и подставьте свой токен Telegram-бота и chat id:
   ```bash
   cp .env.example .env
   # отредактируйте .env: TELEGRAM_BOT_TOKEN=..., TELEGRAM_CHAT_ID=...
   ```
2. Поднимите стек:
   ```bash
   docker compose up --build
   ```
3. Откройте:
   - Swagger producer'а: http://localhost:3000/api
   - RabbitMQ management: http://localhost:15672 (guest/guest)

### Отправка события

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "telegram.message",
    "payload": { "title": "Test", "text": "Hello from FinSolutions" }
  }'
```

Ответ `202 Accepted`:
```json
{ "eventId": "b6f1d2f3-...", "occurredAt": "2026-05-09T12:34:56.789Z", "status": "accepted" }
```

Сервис уведомлений потребляет событие и отправляет сообщение в ваш Telegram-чат. Если передавать chatId - заменяет значение чата из .env

## Локальная разработка (без Docker)

```bash
npm install
docker compose up rabbitmq redis postgres    # только инфраструктура
cp .env.example .env                         # выставьте RABBITMQ_URL=amqp://localhost:5672, REDIS_URL=redis://localhost:6379, DATABASE_URL=postgres://finsol:finsol@localhost:5432/finsol
npm run start:producer:dev                   # терминал 1
npm run start:notification:dev               # терминал 2
```

Миграция outbox (`db/migrations/001_outbox.sql`) применяется автоматически при первом старте контейнера Postgres через `/docker-entrypoint-initdb.d`.

## Тесты

```bash
npm test                # unit-тесты (use-cases)
npm run test:e2e        # e2e producer REST (publisher замокан)
npm run test:cov        # отчёт по покрытию
```

## Переменные окружения

| Переменная                | Описание                                                         | По умолчанию |
|---------------------------|------------------------------------------------------------------|--------------|
| `PRODUCER_PORT`           | HTTP-порт producer'а                                             | `3000`       |
| `DATABASE_URL`            | Postgres URI для outbox                                          | —            |
| `DATABASE_POOL_MAX`       | Размер пула pg                                                   | `10`         |
| `OUTBOX_POLL_INTERVAL_MS` | Период опроса в relay                                            | `1000`       |
| `OUTBOX_BATCH_SIZE`       | Сколько строк забирается за один тик                             | `50`         |
| `OUTBOX_MAX_ATTEMPTS`     | Сколько попыток relay делает до парковки                         | `10`         |
| `RABBITMQ_URL`            | AMQP URI подключения                                             | —            |
| `RABBITMQ_RETRY_TTL_MS`   | TTL очереди retry (мс) до возврата сообщения                     | `10000`      |
| `RABBITMQ_MAX_RETRIES`    | Максимум попыток до DLQ                                          | `5`          |
| `REDIS_URL`               | Redis URI для хранилища идемпотентности                          | —            |
| `IDEMPOTENCY_TTL_SECONDS` | TTL ключей `done` для `eventId`                                  | `86400`      |
| `IDEMPOTENCY_PENDING_TTL_SECONDS` | TTL «надгробий» `pending` (окно при падении)             | `60`         |
| `TELEGRAM_BOT_TOKEN`      | Токен бота от @BotFather                                         | —            |
| `TELEGRAM_CHAT_ID`        | Chat id по умолчанию (можно переопределить в событии)            | —            |
| `TELEGRAM_PARSE_MODE`     | Опционально: `Markdown` / `MarkdownV2` / `HTML`. По умолчанию — обычный текст. | — |
| `LOG_LEVEL`               | Уровень логов pino                                               | `info`       |

## Заметки по архитектурным решениям

- **Outbox** развязывает приём HTTP-запроса и доступность брокера. Транзакционная граница producer'а — это Postgres; RabbitMQ — лишь механизм доставки. Это классический способ гарантировать «as-least-once доставку до брокера» без распределённых транзакций.
- **Polling + `FOR UPDATE SKIP LOCKED`** вместо LISTEN/NOTIFY: проще, горизонтально масштабируется, естественно восстанавливается после простоя relay-воркера. Задержка ограничена `OUTBOX_POLL_INTERVAL_MS` (по умолчанию 1 с).
- `@golevelup/nestjs-rabbitmq` вместо «голого» `@nestjs/microservices` — полноценная поддержка topic-обменников, декораторных subscriber'ов и встроенного управления соединением.
- Redis-хранилище идемпотентности оставляет consumer'а stateless и горизонтально масштабируемым.
- Заголовок-счётчик попыток для каждого сообщения позволяет не полагаться на семантику массива `x-death` в RabbitMQ, которая различается для reject'а и истечения TTL.
