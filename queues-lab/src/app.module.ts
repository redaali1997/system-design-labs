import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './orders/order.entity';
import { PaymentEvent } from './payment-events/payment-event.entity';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [Order, PaymentEvent],
        synchronize: true,
        logging: ['query'],
      }),
    }),
    RabbitMQModule,
    WebhooksModule,
  ],
})
export class AppModule {}
