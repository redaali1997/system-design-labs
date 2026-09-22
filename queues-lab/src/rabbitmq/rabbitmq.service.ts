import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export const PAYMENT_EVENTS_QUEUE = 'payment-events';

@Injectable()
export class RabbitMQService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.ConfirmChannel;
  private readonly ready: Promise<void>;

  constructor(private readonly config: ConfigService) {
    // Kicked off immediately (not in onModuleInit) so other providers can
    // safely `await getChannel()` regardless of Nest's module-init order.
    this.ready = this.connect();
  }

  private async connect(): Promise<void> {
    const url = this.config.getOrThrow<string>("RABBITMQ_URL");
    const maxAttempts = 10;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.connection = await amqp.connect(url);
        this.channel = await this.connection.createConfirmChannel();
        await this.channel.assertQueue(PAYMENT_EVENTS_QUEUE, { durable: true });
        this.logger.log(
          `Connected to RabbitMQ, queue "${PAYMENT_EVENTS_QUEUE}" ready`,
        );
        return;
      } catch (err) {
        const delayMs = Math.min(1000 * 2 ** attempt, 10_000);
        this.logger.warn(
          `RabbitMQ connect attempt ${attempt}/${maxAttempts} failed: ${(err as Error).message}. Retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error("Could not connect to RabbitMQ after multiple attempts");
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async getChannel(): Promise<amqp.ConfirmChannel> {
    await this.ready;
    return this.channel;
  }

  async publish(queue: string, payload: unknown): Promise<void> {
    const channel = await this.getChannel();
    return new Promise((resolve, reject) => {
      channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
}
