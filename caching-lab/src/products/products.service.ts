import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Product } from "./product.entity";
import { REDIS_CLIENT } from "src/redis/redis.provider";
import Redis from "ioredis";

const LOCK_TTL_MS = 3000;
const LOCK_WAIT_RETRY_MS = 50;
const LOCK_WAIT_MAX_RETRIES = 40; // ~2s total before giving up and reading DB directly

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // Backing method for GET /products/:id.
  async findOne(id: number): Promise<Product> {
    const cacheKey = `product:${id}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    // Cache miss: only one caller should go fetch from MySQL and repopulate
    // the cache. Everyone else waits for that result instead of piling onto
    // the DB at the same time (the stampede from the k6 test).
    const lockKey = `lock:product:${id}`;
    let holdsLock = false;
    try {
      const lockResult = await this.redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX");
      holdsLock = lockResult === "OK";
    } catch (e) {}

    if (!holdsLock) {
      for (let i = 0; i < LOCK_WAIT_MAX_RETRIES; i++) {
        await sleep(LOCK_WAIT_RETRY_MS);
        try {
          const cached = await this.redis.get(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) {
          break; // Redis is down — stop waiting on it, fall through to DB
        }
      }
      // Lock holder never finished (crashed, slow, or Redis unavailable).
      // Read straight from MySQL rather than waiting forever.
    }

    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(product),
        "EX",
        10 + Math.floor(Math.random() * 4),
      );
    } catch (e) {}

    if (holdsLock) {
      try {
        await this.redis.del(lockKey);
      } catch (e) {}
    }

    return product;
  }

  // Backing method for GET /products/:id/no-cache.
  // Always reads straight from MySQL — the control group, keep it that way.
  async findOneNoCache(id: number): Promise<Product> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async updatePrice(id: number, price: number): Promise<Product> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    product.price = price;
    await this.productRepo.save(product);
    try {
      await this.redis.del(`product:${id}`);
    } catch (e) {}
    return product;
  }
}
