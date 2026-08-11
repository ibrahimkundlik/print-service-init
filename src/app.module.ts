import Redis from 'ioredis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from './Modules/Logger/logger.module';
import { PrintersModule } from './Modules/Printers/printers.module';
import { RenderModule } from './Modules/Render/render.module';
import { PrintJobsModule } from './Modules/PrintJobs/print-jobs.module';
import { CloudModule } from './Modules/Cloud/cloud.module';
import { AuthModule } from './Modules/Auth/auth.module';
import { RedisModule, REDIS_CLIENT } from './Core/Redis/redis.module';
import { redisCacheStore } from './Core/Cache/redis-cache.store';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      connectionName: 'mongodb',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),

    RedisModule,
    CacheModule.registerAsync({
      inject: [REDIS_CLIENT],
      useFactory: async (redisClient: Redis) => ({
        store: redisCacheStore,
        client: redisClient,
        keyPrefix: 'print-service:cache:',
        ttl: 10 * 60 * 1000,
      }),
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),
    LoggerModule,
    AuthModule,
    PrintersModule,
    RenderModule,
    PrintJobsModule,
    CloudModule,
  ],
})
export class AppModule {}
