import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { PAYMENT_EVENTS_QUEUE, RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/payment')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  // Naive synchronous control group — no queue, no idempotency check.
  @Post('sync')
  @HttpCode(200)
  async receiveSync(@Body() payload: WebhookPayloadDto) {
    this.logger.log(
      `[webhook:sync] received providerEventId=${payload.providerEventId} at ${new Date().toISOString()}`,
    );
    await this.webhooksService.processSync(payload);
    return { received: true };
  }

  // Publishes to RabbitMQ and returns immediately after the publish confirm.
  @Post()
  @HttpCode(200)
  async receiveAsync(@Body() payload: WebhookPayloadDto) {
    this.logger.log(
      `[webhook:async] received providerEventId=${payload.providerEventId} at ${new Date().toISOString()}`,
    );
    await this.rabbitMQService.publish(PAYMENT_EVENTS_QUEUE, payload);
    return { received: true, queued: true };
  }
}
