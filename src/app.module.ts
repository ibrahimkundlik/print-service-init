import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from './Modules/Logger/logger.module';
import { PrintersModule } from './Modules/Printers/printers.module';
import { RenderModule } from './Modules/Render/render.module';
import { PrintsModule } from './Modules/Prints/prints.module';
import { CloudModule } from './Modules/Cloud/cloud.module';

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

    ScheduleModule.forRoot(),
    LoggerModule,
    PrintersModule,
    RenderModule,
    PrintsModule,
    CloudModule,
  ],
})
export class AppModule {}
