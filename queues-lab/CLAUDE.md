I want a separate NestJS lab called `queues-lab`, which I'll use to apply the
"Queues and Asynchronous Work" unit from my System Design track. This lab is
completely separate from any real project — treat it as fully disposable.

Requirements:

1. Infrastructure: docker-compose with two services — a NestJS app and
   RabbitMQ (use the `rabbitmq:3-management` image so the management UI is
   available on port 15672 — useful to visually watch queue depth and message
   rates). Standard NestJS project structure with TypeORM connected to a
   MySQL container as well (three services total: app, MySQL 8, RabbitMQ).

2. Two entities:
   - `Order` (id, customerId, status: enum ['pending','paid','refunded','failed'],
     amount, createdAt)
   - `PaymentEvent` (id, providerEventId (string), orderId, type: enum
     ['paid','refunded','failed'], receivedAt, processedAt nullable)

   Seed script that creates 50 orders in `pending` status with realistic amounts.

3. Two webhook endpoints, both accepting the same payload shape
   `{ providerEventId, orderId, type, amount }`:
   - `POST /webhooks/payment/sync` — a naive synchronous handler: validates the
     payload, then directly does everything inline (insert into PaymentEvent,
     update Order.status) with NO idempotency check and NO queue at all. This is
     the control group representing the "before" state.
   - `POST /webhooks/payment` — validates the payload, publishes a message onto
     a RabbitMQ queue named `payment-events` (declare it as a durable queue, no
     exchange logic needed beyond the default direct binding), and responds 200
     immediately after the publish confirm (don't wait for processing).

4. Wire up a RabbitMQ consumer that consumes from `payment-events` and does the
   *same* insert-into-PaymentEvent + update-Order.status work as the sync
   endpoint — but leave it deliberately naive: no idempotency check (no unique
   constraint on providerEventId, no duplicate-key handling), no
   state-transition validation, no retry/backoff logic at all, and no
   dead-letter-exchange configured. On any processing error, just log it and
   nack the message with `requeue: false` (drop it) — don't build a retry
   pattern. I'll implement idempotency, ordering validation, a TTL +
   dead-letter-exchange retry pattern with backoff, and proper dead-lettering
   myself as the exercise — please don't write any of that logic, just leave
   clear `// TODO` markers where each piece belongs.

5. Logging: log every webhook received (with providerEventId and a timestamp),
   every time the consumer picks up a message and starts processing it, and
   every time it finishes, fails, or gets nacked — enough that duplicate
   processing is visible in the console output, not just inferred.

6. A load/chaos script (plain Node script or k6, your choice) that hits the
   HTTP endpoints (not the broker directly) with easily editable parameters
   that can:
   - Send the same `providerEventId` N times in quick succession (simulate a
     provider retry)
   - Send two events for the same order out of order (e.g. `refunded` before
     `paid`)
   - Send a burst of M distinct events at once (simulate a load spike)
   - Optionally inject a small percentage of artificial delay/failure into the
     consumer's DB write, so retry behavior is actually observable once I build it

7. Important rule for how we work together after the scaffold is done: each
   TODO left in step 4 (idempotency, ordering validation, retry + backoff,
   dead-lettering) is something I want to implement myself. When I come back
   and ask you for help on one of them, first explain the concept and show me
   example code — don't write the implementation directly into my files unless
   I explicitly ask you to just do it for me. I want to see and understand the
   code before I apply it by hand.

Before writing any code, show me a checklist of exactly what you're going to
scaffold (plan mode) and wait for my go-ahead.
