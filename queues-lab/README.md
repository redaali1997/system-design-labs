# queues-lab

A hands-on NestJS lab for practicing the "Queues and Asynchronous Work" unit of System Design: decoupling a webhook receiver from its processing via RabbitMQ, and then hardening that naive consumer with idempotency, ordering validation, retry/backoff, and dead-lettering — measured against a synchronous "before" control group under chaos conditions, not just reasoned about on paper.

## Stack

- **NestJS + TypeORM** — app layer, MySQL as the source of truth (`logging: ['query']` enabled).
- **MySQL 8** — `Order` and `PaymentEvent` tables.
- **RabbitMQ 3 (management image)** — durable `payment-events` queue, consumed via raw `amqplib` so the channel/ack/nack mechanics stay visible. Management UI at [http://localhost:15672](http://localhost:15672) (guest/guest) — use it to watch queue depth and message rates live.
- **k6** — chaos/load testing against the HTTP endpoints, with an editable `CONFIG` block.

All three services (app, MySQL, RabbitMQ) run in Docker.

## Setup

```bash
docker compose up --build
cp .env.example .env     # only needed if you run the app outside Docker
npm install               # only needed if you run seed/lint locally, outside Docker
npm run seed               # inserts 50 pending orders — run inside the app container, or locally against localhost:3308
```

`npm run seed` connects using `DB_HOST`/`DB_PORT` from your environment. From your host machine that's `localhost:3308`; inside the `app` container it's `mysql:3306` (already set via `docker-compose.yml`). Easiest: `docker compose exec app npm run seed`.

## Endpoints

Both accept `{ providerEventId, orderId, type, amount }`, where `type` is one of `paid` / `refunded` / `failed`.

| Endpoint | Behavior |
|---|---|
| `POST /webhooks/payment/sync` | **Control group.** Validates, then inserts `PaymentEvent` + updates `Order.status` inline, synchronously. No idempotency check, no queue. |
| `POST /webhooks/payment` | Validates, publishes to the durable `payment-events` queue (waits for the publisher confirm), responds `200` immediately — does not wait for the consumer. |

## The consumer — deliberately naive

[`src/rabbitmq/payment-events.consumer.ts`](src/rabbitmq/payment-events.consumer.ts) consumes `payment-events` and does the same two writes as the sync endpoint, but with everything past that stripped out on purpose:

- No idempotency check — no unique constraint on `providerEventId`, so the same event processed twice creates two `PaymentEvent` rows and re-applies the status update.
- No state-transition validation — a `refunded` event will happily overwrite a `pending` order that was never `paid`.
- No retry/backoff — on any error it just logs and `nack`s with `requeue: false` (the message is dropped).
- No dead-letter-exchange — dropped messages are gone, not parked anywhere for inspection.

Each of those has a `// TODO` marker at the exact spot it belongs, left for you to implement as the exercise. **When you ask for help on one of these, expect an explanation + example code first — implementation only goes into your files if you explicitly say to just do it.**

Two env vars let you inject chaos into the consumer's DB write, to make retry behavior observable once you build it (0 disables both, set in `docker-compose.yml` or `.env`):

- `CHAOS_FAILURE_RATE` — probability (0–1) the write throws instead of succeeding.
- `CHAOS_DELAY_MS_MAX` — adds a random `0..N` ms delay before the write.

## Logging

Every stage is logged with `providerEventId` so duplicate processing is visible directly in the console, not just inferred:

- `[webhook:sync]` / `[webhook:async]` — on receipt, with a timestamp.
- `[consumer] picked up` — when a message is pulled off the queue.
- `[consumer] finished` — on successful processing (ack'd).
- `[consumer] FAILED` / `nacking` — on error (nack'd, dropped).

## Chaos / load testing

```bash
k6 run load/chaos-test.js
```

Edit the `CONFIG` block at the top of `load/chaos-test.js` to toggle three scenarios, each hitting the HTTP endpoints only (never the broker directly):

- `DUPLICATE_RETRY` — resends the same `providerEventId` several times in quick succession (simulates a provider retry).
- `OUT_OF_ORDER` — sends `refunded` before `paid` for the same order.
- `BURST` — fires a configurable number of distinct events at once (load spike).

Switch `CONFIG.ENDPOINT` between `/webhooks/payment` (async/queued) and `/webhooks/payment/sync` (control group) to compare behavior between the two paths.
