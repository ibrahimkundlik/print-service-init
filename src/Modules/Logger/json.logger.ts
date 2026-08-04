import { LoggerService } from '@nestjs/common';

/**
 * Custom JSON logger — replaces Nest's default app-wide (see main.ts).
 * Mirrors prime-dr3's Modules/Logger/json.logger.ts for consistency.
 */
export class JsonLogger implements LoggerService {
  log(event: any, context?: any) {
    const logData = {
      datetime: new Date().toISOString(),
      level: 'info',
      event: event,
      context,
    };
    console.log(JSON.stringify(logData));
  }

  error(event: any, trace?: string, context?: any) {
    const logData = {
      datetime: new Date().toISOString(),
      level: 'error',
      event: event,
      trace,
      context,
    };
    console.error(JSON.stringify(logData));
  }

  warn(event: any, context?: any) {
    const logData = {
      datetime: new Date().toISOString(),
      level: 'warn',
      event: event,
      context,
    };
    console.warn(JSON.stringify(logData));
  }
}
