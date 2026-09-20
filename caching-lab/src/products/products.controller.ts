import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { UpdatePriceDto } from './dto/update-price.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Get(':id/no-cache')
  findOneNoCache(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOneNoCache(id);
  }

  @Patch(':id/price')
  updatePrice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePriceDto,
  ) {
    return this.productsService.updatePrice(id, dto.price);
  }
}
