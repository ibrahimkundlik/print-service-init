import { Injectable } from '@nestjs/common';

/**
 * The minimum event set from FINAL_SPEC.md §12 — structured JSON events shipped to
 * Kibana (via stdout -> Filebeat/Logstash, same pattern as prime-dr3's JsonLogger)
 * instead of a dedicated MongoDB audit-event collection.
 */
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
