import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { REDIS_CLIENT } from 'src/redis/redis.provider';
import Redis from 'ioredis';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // Backing method for GET /products/:id.
  // No caching yet — add cache-aside here yourself.
  async findOne(id: number): Promise<Product> {
    try {
      const cached = await this.redis.get(`product:${id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    await this.redis.set(`product:${id}`, JSON.stringify(product), 'EX', 300);
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
    await this.redis.del(`product:${id}`);
    return product;
  }
}
