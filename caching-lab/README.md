# caching-lab

A hands-on NestJS lab for practicing the Caching unit of System Design: cache-aside, TTL/staleness trade-offs, invalidation, resilience to a Redis outage, and cache stampede protection — measured against a real MySQL-backed dataset under k6 load, not just reasoned about on paper.

## Stack

- **NestJS + TypeORM** — app layer, with `logging: ['query']` enabled so every request's DB hit (or lack of one) is visible in the terminal.
- **MySQL 8** — source of truth, 50,000 seeded products.
- **Redis 7** — cache layer, wired up via `ioredis`.
- **k6** — load testing, with an editable `CONFIG` block for VUs/duration/target.

Only MySQL and Redis run in Docker; the app runs locally (`npm run start:dev`) so query logs and hot reload stay visible while iterating.

## Setup

```bash
docker compose up -d      # MySQL 8 + Redis 7
cp .env.example .env      # adjust ports if 3307/6379 collide with something local
npm install
npm run seed               # inserts 50,000 products (~3s)
npm run start:dev
```

## Endpoints

| Endpoint | Behavior |
|---|---|
| `GET /products/:id` | Cache-aside read: Redis first, MySQL on miss, repopulates the cache. |
| `GET /products/:id/no-cache` | Always reads MySQL directly — the control group for comparison. |
| `PATCH /products/:id/price` | Updates the price and invalidates the cached entry. |

## How the cache-aside implementation works

`ProductsService.findOne` ([src/products/products.service.ts](src/products/products.service.ts)) implements:

1. **Read-through with TTL**: check Redis first; on a miss, read MySQL, then populate Redis with a TTL (jittered a few seconds to avoid many *different* keys expiring in lockstep).
2. **Write-invalidation**: `PATCH /products/:id/price` deletes the cached entry immediately rather than waiting for the TTL, so the next read is guaranteed fresh.
3. **Resilience**: every Redis call is guarded — if Redis is unreachable, reads and writes fall straight through to MySQL instead of failing the request. Caching is an optional optimization here, never a hard dependency.
4. **Stampede protection**: a short-lived Redis lock (`SET ... NX PX`) ensures that when a *single hot key* expires under concurrent load, only one request repopulates it from MySQL while the rest wait on the lock (falling back to a direct DB read if the lock holder never finishes, so no request waits forever).

## Load testing

```bash
k6 run load-test.js
```

Edit the `CONFIG` block at the top of `load-test.js` to change VUs, duration, the product-id range, or target `/no-cache` for the control group.

### Results measured in this lab

**Cache only pays off when there's actual repeat traffic on the same keys.** Hitting a uniformly random id out of the full 50,000-product catalog (20 VUs, 30s) barely benefits from caching — most requests are misses either way:

| | with cache | no-cache (control) |
|---|---|---|
| avg latency | 6.16ms | 6.51ms |
| p95 latency | 11.46ms | 11.03ms |

Restricting the id range to a hot set of 50 products (simulating popular items) makes the effect obvious — the same 20 VUs now get cache hits:

| | with cache | no-cache (control) |
|---|---|---|
| avg latency | **1.46ms** | 5.78ms |
| p95 latency | **2.47ms** | 10.22ms |

**Cache stampede**, reproduced with a single fixed hot key and 50 concurrent VUs over 30s (short TTL to observe several expiry cycles in the test window):

| protection | DB queries for that one key in 30s |
|---|---|
| none | 72 |
| TTL jitter alone | ~51 (jitter desynchronizes *different* keys' expiry — it doesn't help a single key hammered by many concurrent requests) |
| **Redis lock** | **~2** (close to the theoretical minimum of ~3 for that TTL window) |
