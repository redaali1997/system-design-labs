I want a separate NestJS lab called caching-lab, which I'll use to apply the Caching unit from System Design.

Requirements:

1. docker-compose with:
   - MySQL 8
   - Redis 7
   - The app itself (either inside a container, or run it locally with just these two in containers — pick whichever is simpler)

2. A simple NestJS module called Products:
   - Entity: id, name, description, price, stockQuantity
   - GET /products/:id — reads from MySQL by primary key (indexed by default)
   - PATCH /products/:id/price — updates the price (I'll use this to test invalidation)
   - A seed script that creates 50,000 products with reasonable random data

3. A Redis module (create a simple provider using ioredis, or whatever package NestJS/TypeORM prefers), but leave it with no cache logic for now — I'll implement cache-aside myself as an exercise, I don't want you to write it.

4. Enable query logging (logging: ['query'] in TypeORM) so I can actually see when a request hits the database and when it doesn't.

5. Create a k6 script (load-test.js) that hits GET /products/:id with configurable load (vus, duration as easily editable options).

6. Also create one more endpoint, GET /products/:id/no-cache, that always reads straight from the database with no possibility of caching — I'll use it as a control group for comparison.

Before writing any code, show me a checklist of exactly what you're going to scaffold (plan mode) and wait for my go-ahead. Leave the cache logic empty so I can write it myself.

One more thing: please reply to me in Egyptian Arabic from here on — this prompt is in English for precision, but I'd like your responses in Arabic.