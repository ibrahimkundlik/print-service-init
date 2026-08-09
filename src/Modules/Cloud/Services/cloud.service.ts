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

/** §5.3 — orchestrates the two `ConnectionType` flows the printer itself calls. */
@Injectable()
export class CloudService {
  private readonly logger = new Logger(CloudService.name);

  constructor(
    private readonly printersService: PrintersService,
    private readonly printJobsService: PrintJobsService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  /**
   * `ConnectionType=GetRequest` (§5.3): heartbeat first (even on an empty queue),
   * then dequeue+render. Returns `null` for the "nothing queued" case so the
   * controller can send an empty `200` body per §7.
   */
  async handleGetRequest(printer: Printer): Promise<string | null> {
    await this.printersService.recordHeartbeat(printer._id);

    this.eventLogger.logEvent(LogEvents.PRINTER_HEARTBEAT, {
      printerId: printer._id,
    });

    const jobInputs = await this.printJobsService.dequeueForPrinter(printer);
    if (jobInputs.length === 0) {
      return null;
    }

    return this.printJobsService.buildPrintRequestXml(jobInputs);
  }

  async handleSetResponse(
    printer: Printer,
    responseFileXml: string | undefined,
  ): Promise<void> {
    if (!responseFileXml) {
      this.logger.log('DEBUG :: CloudService handleSetResponse', {
        message: `SetResponse with no ResponseFile from printer ${printer._id}`,
      });
      return;
    }

    const outcomes = this.parseResponseFile(responseFileXml);
    for (const outcome of outcomes) {
      await this.printJobsService.recordSetResponseOutcome(
        outcome.printjobid,
        outcome.success,
        outcome.failureCode,
        outcome.statusCode,
      );
    }
  }

  /**
   * Parses the printer's `<PrintResponseInfo>` document (§2/§5.3) into per-job
   * outcomes. Confirmed against a real device's actual SetResponse payload — one
   * `<ePOSPrint>` block per job (same tag name as the request envelope, not a
   * separate "...Response" tag), each wrapping `<Parameter><printjobid>` and
   * `<PrintResponse><response success="..." code="..." .../></PrintResponse>`,
   * with `success`/`code` as XML attributes on that nested `<response>` element,
   * not on the `<ePOSPrint>` entry itself:
   *
   *   <ePOSPrint>
   *     <Parameter><printjobid>...</printjobid></Parameter>
   *     <PrintResponse>
   *       <response success="true" code="" status="..." battery="0"/>
   *     </PrintResponse>
   *   </ePOSPrint>
   */
  private parseResponseFile(xml: string): SetResponseOutcome[] {
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
  }
}
