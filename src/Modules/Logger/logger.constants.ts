/** The fixed set of structured business events EventLoggerService emits. */
export const LogEvents = {
  JOB_QUEUED: 'job_queued',
  JOB_DELIVERED: 'job_delivered',
  JOB_SUCCESS: 'job_success',
  JOB_FAILED: 'job_failed',
  JOB_RETRIED: 'job_retried',
  JOB_EXPIRED: 'job_expired',

  QUEUE_DEPTH: 'queue_depth',
  NO_PRINTERS: 'no_printers',
  RENDER_FAILED: 'render_failed',
  PRINTER_HEARTBEAT: 'printer_heartbeat',
} as const;
