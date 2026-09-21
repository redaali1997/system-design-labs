import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { PaymentEvent } from '../payment-events/payment-event.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, PaymentEvent])],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
