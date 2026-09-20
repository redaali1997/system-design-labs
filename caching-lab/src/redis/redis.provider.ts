import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Redis({
      host: config.get<string>('REDIS_HOST'),
      port: config.get<number>('REDIS_PORT'),
    });
  },
};
