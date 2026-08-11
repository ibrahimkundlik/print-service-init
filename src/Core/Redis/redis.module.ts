import Redis from 'ioredis';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Single shared ioredis connection, reused by the cache-manager store
 *
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: +configService.getOrThrow<string>('REDIS_PORT'),
          password: configService.getOrThrow<string>('REDIS_PASSWORD'),
          db: configService.getOrThrow<number>('REDIS_DB'),
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
