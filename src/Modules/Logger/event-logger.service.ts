import { Injectable } from '@nestjs/common';
import { LogEvents } from './logger.constants';

const LOG_TYPE = 'global_log';
export type LogEventName = (typeof LogEvents)[keyof typeof LogEvents];

@Injectable()
export class EventLoggerService {
  logEvent(event: LogEventName, fields: Record<string, unknown>): void {
    const logData = {
      event,
      level: 'info',
      logType: LOG_TYPE,
      datetime: new Date().toISOString(),
      ...(fields || {}),
    };
    console.log(JSON.stringify(logData));
  }
}
