import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from './Modules/Logger/logger.module';
import { PrintersModule } from './Modules/Printers/printers.module';
import { RenderModule } from './Modules/Render/render.module';
import { PrintsModule } from './Modules/Prints/prints.module';
import { CloudModule } from './Modules/Cloud/cloud.module';
import { AuthModule } from './Modules/Auth/auth.module';

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

    /**
     * In-memory cache backing AuthService's Prime-authorities lookups (5 min TTL,
     * see auth.service.ts). Deliberately not Redis-backed like prime-dr3's —
     * that needs its own Redis client/module this service doesn't otherwise need
     * yet. Swap for a Redis store here later without touching Auth code if this
     * service ever runs multiple instances and needs a shared cache.
     */
    CacheModule.register({ isGlobal: true, ttl: 300000 }),

    ScheduleModule.forRoot(),
    LoggerModule,
    AuthModule,
    PrintersModule,
    RenderModule,
    PrintsModule,
    CloudModule,
  ],
})
export class AppModule {}
