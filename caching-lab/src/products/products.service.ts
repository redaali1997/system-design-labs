import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // Backing method for GET /products/:id.
  // No caching yet — add cache-aside here yourself.
  async findOne(id: number): Promise<Product> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
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
    return this.productRepo.save(product);
  }
}
