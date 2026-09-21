import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { PaymentEvent } from '../payment-events/payment-event.entity';
import { PaymentEventsConsumer } from './payment-events.consumer';
import { RabbitMQService } from './rabbitmq.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Order, PaymentEvent])],
  providers: [RabbitMQService, PaymentEventsConsumer],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
