import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { PaymentEvent } from '../payment-events/payment-event.entity';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

// This is the "before" control group: naive, inline, synchronous processing
// with no idempotency check and no state-transition validation. It stays
// this way on purpose — it's the baseline the async path is compared against.
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEvents: Repository<PaymentEvent>,
  ) {}

  async processSync(payload: WebhookPayloadDto): Promise<void> {
    await this.paymentEvents.save(
      this.paymentEvents.create({
        providerEventId: payload.providerEventId,
        orderId: payload.orderId,
        type: payload.type,
        processedAt: new Date(),
      }),
    );

    await this.orders.update(payload.orderId, { status: payload.type });

    this.logger.log(
      `[sync] processed providerEventId=${payload.providerEventId} orderId=${payload.orderId} -> status=${payload.type}`,
    );
  }
}
