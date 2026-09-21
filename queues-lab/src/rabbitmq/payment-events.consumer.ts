import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import type { ConsumeMessage } from "amqplib";
import { Repository } from "typeorm";
import { Order } from "../orders/order.entity";
import { PaymentEvent } from "../payment-events/payment-event.entity";
import { PAYMENT_EVENTS_QUEUE, RabbitMQService } from "./rabbitmq.service";
import { QueryFailedError } from "typeorm";

interface PaymentEventMessage {
  providerEventId: string;
  orderId: number;
  type: "paid" | "refunded" | "failed";
  amount: number;
}

// Deliberately naive consumer: no idempotency check, no ordering/state
// validation, no retry/backoff, no dead-letter-exchange. Each of those is
// left as a TODO for you to implement yourself. On any failure it just
// logs and drops the message (`nack` with `requeue: false`).
@Injectable()
export class PaymentEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentEventsConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly config: ConfigService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEvents: Repository<PaymentEvent>,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = await this.rabbitMQService.getChannel();
    await channel.consume(
      PAYMENT_EVENTS_QUEUE,
      (msg) => this.handleMessage(msg),
      {
        noAck: false,
      },
    );
    this.logger.log(`Consuming from "${PAYMENT_EVENTS_QUEUE}"`);
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      return;
    }

    const channel = await this.rabbitMQService.getChannel();
    const payload: PaymentEventMessage = JSON.parse(msg.content.toString());

    this.logger.log(
      `[consumer] picked up providerEventId=${payload.providerEventId} orderId=${payload.orderId} type=${payload.type} at ${new Date().toISOString()}`,
    );

    try {
      await this.maybeInjectChaos();

      try {
        await this.paymentEvents.save(
          this.paymentEvents.create({
            providerEventId: payload.providerEventId,
            orderId: payload.orderId,
            type: payload.type,
            processedAt: new Date(),
          }),
        );
      } catch (err) {
        const isDuplicate =
          err instanceof QueryFailedError &&
          (err as any).driverError?.code === "ER_DUP_ENTRY";

        if (isDuplicate) {
          this.logger.warn(
            `[consumer] duplicate providerEventId=${payload.providerEventId} — already processed, skipping`,
          );
          channel.ack(msg);
          return;
        }
        throw err;
      }

      // TODO (ordering / state-transition validation): verify the order's
      // current status allows this transition (e.g. don't apply "refunded"
      // to an order that was never "paid") before blindly overwriting it.

      await this.orders.update(payload.orderId, { status: payload.type });

      this.logger.log(
        `[consumer] finished providerEventId=${payload.providerEventId} orderId=${payload.orderId} at ${new Date().toISOString()}`,
      );
      channel.ack(msg);
    } catch (err) {
      this.logger.error(
        `[consumer] FAILED providerEventId=${payload.providerEventId} orderId=${payload.orderId}: ${(err as Error).message}`,
      );

      // TODO (retry + backoff): instead of dropping the message, republish it
      // with a TTL onto a retry/delay queue so it comes back after a backoff
      // period (e.g. per-attempt TTL queues or a delayed-message exchange).

      // TODO (dead-lettering): configure a dead-letter-exchange on the
      // "payment-events" queue so nack'd/expired messages land in a DLQ for
      // inspection instead of being lost forever.

      this.logger.warn(
        `[consumer] nacking (no requeue) providerEventId=${payload.providerEventId}`,
      );
      channel.nack(msg, false, false);
    }
  }

  // Optional chaos injection for exercising retry behavior later. Controlled
  // via CHAOS_FAILURE_RATE (0-1) and CHAOS_DELAY_MS_MAX env vars — both 0 by
  // default, meaning this is a no-op unless you turn them on.
  private async maybeInjectChaos(): Promise<void> {
    const failureRate = Number(this.config.get("CHAOS_FAILURE_RATE") ?? 0);
    const maxDelayMs = Number(this.config.get("CHAOS_DELAY_MS_MAX") ?? 0);

    if (maxDelayMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * maxDelayMs),
      );
    }

    if (failureRate > 0 && Math.random() < failureRate) {
      throw new Error("Injected chaos failure");
    }
  }
}
