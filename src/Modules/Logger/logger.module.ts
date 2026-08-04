import { Global, Module } from '@nestjs/common';
import { JsonLogger } from './json.logger';
import { EventLoggerService } from './event-logger.service';

@Global()
@Module({
  providers: [
    {
      provide: 'LoggerService',
      useClass: JsonLogger,
    },
    EventLoggerService,
  ],
  exports: ['LoggerService', EventLoggerService],
})
export class LoggerModule {}
