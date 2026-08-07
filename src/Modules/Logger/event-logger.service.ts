import { Injectable } from '@nestjs/common';

export type PrintEventName =
  | 'job.queued'
  | 'job.delivered'
  | 'job.success'
  | 'job.failed'
  | 'job.retried'
  | 'job.expired'
  | 'printer.heartbeat'
  | 'queue.depth';

@Injectable()
export class EventLoggerService {
  logEvent(event: PrintEventName, fields: Record<string, unknown>): void {
    const logData = {
      datetime: new Date().toISOString(),
      level: 'info',
      event,
      ...fields,
    };
    console.log(JSON.stringify(logData));
  }
}
