import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { Printer } from '../../Printers/Schemas/printer.schema';
import { PrintersService } from '../../Printers/Services/printers.service';
import { PrintJobsService } from '../../PrintJobs/Services/print-jobs.service';
import { EventLoggerService } from '../../Logger/event-logger.service';
import { LogEvents } from '../../Logger/logger.constants';

interface SetResponseOutcome {
  printjobid: string;
  success: boolean;
  failureCode?: string;
  statusCode?: number;
}

const responseFileParser = new XMLParser({ ignoreAttributes: false });

@Injectable()
export class CloudService {
  private readonly logger = new Logger(CloudService.name);

  constructor(
    private readonly printersService: PrintersService,
    private readonly printJobsService: PrintJobsService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  async handleGetRequest(printer: Printer): Promise<string | null> {
    const printerId = printer._id;

    try {
      await this.printersService.recordHeartbeat(printerId);
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        printerId,
        error: err?.message,
        event: 'PRINTER_HEARTBEAT_FAILED',
      });
      throw err;
    }

    this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
      printerId,
      event: 'PRINTER_HEARTBEAT',
    });

    let jobInputs: Awaited<ReturnType<PrintJobsService['dequeueForPrinter']>>;
    try {
      jobInputs = await this.printJobsService.dequeueForPrinter(printer);
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        printerId,
        error: err?.message,
        event: 'PRINTER_DEQUEUE_FAILED',
      });
      throw err;
    }

    if (jobInputs.length === 0) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        printerId,
        event: 'PRINTER_NO_DEQUEUE_JOBS',
      });
      return null;
    }

    return this.printJobsService.buildPrintRequestXml(jobInputs);
  }

  async handleSetResponse(
    printer: Printer,
    responseFileXml: string | undefined,
  ): Promise<void> {
    if (!responseFileXml) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        printerId: printer._id,
        event: 'PRINTER_SET_RESPONSE_MISSING',
      });
      return;
    }

    const outcomes = this.parseResponseFile(responseFileXml, printer._id);
    for (const outcome of outcomes) {
      await this.printJobsService.recordSetResponseOutcome(
        printer._id,
        outcome.printjobid,
        outcome.success,
        outcome.failureCode,
        outcome.statusCode,
      );
    }
  }

  private parseResponseFile(
    xml: string,
    printerId: string,
  ): SetResponseOutcome[] {
    try {
      const parsed = responseFileParser.parse(xml);
      const root = parsed?.PrintResponseInfo;

      if (!root?.ePOSPrint) {
        return [];
      }

      const entries = Array.isArray(root.ePOSPrint)
        ? root.ePOSPrint
        : [root.ePOSPrint];

      return entries
        .map((entry: Record<string, any>) => {
          const response = entry?.PrintResponse?.response;
          const success =
            String(response?.['@_success']).toLowerCase() === 'true';
          const rawStatus = response?.['@_status'];
          return {
            printjobid: entry?.Parameter?.printjobid,
            success,
            failureCode: success ? undefined : response?.['@_code'],
            statusCode: rawStatus !== undefined ? Number(rawStatus) : undefined,
          };
        })
        .filter((outcome: SetResponseOutcome) => Boolean(outcome.printjobid));
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        printerId,
        event: 'PRINTER_RESPONSE_PARSING_FAILED',
      });
      return [];
    }
  }
}
