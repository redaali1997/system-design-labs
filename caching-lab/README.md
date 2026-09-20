# caching-lab

Hands-on lab for the System Design Caching unit. Redis is wired up with no cache logic — cache-aside is the exercise.

## Setup

```bash
docker compose up -d      # MySQL 8 + Redis 7
npm install
npm run seed               # inserts 50,000 products
npm run start:dev
```

## Endpoints

- `GET /products/:id` — reads MySQL by PK. Add your cache-aside logic in `ProductsService.findOne`.
- `GET /products/:id/no-cache` — always reads MySQL directly, control group for comparison.
- `PATCH /products/:id/price` — updates price, use it to test invalidation.

## Load testing

```bash
k6 run load-test.js
```

Edit the `CONFIG` block at the top of `load-test.js` to change VUs, duration, or target the `/no-cache` endpoint.
