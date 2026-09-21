import { IsIn, IsInt, IsNumber, IsPositive, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @IsString()
  providerEventId: string;

  @IsInt()
  orderId: number;

  @IsIn(['paid', 'refunded', 'failed'])
  type: 'paid' | 'refunded' | 'failed';

  @IsNumber()
  @IsPositive()
  amount: number;
}
