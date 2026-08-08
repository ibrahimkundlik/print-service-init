import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { Printer } from '../../Printers/Schemas/printer.schema';
import { PrintersService } from '../../Printers/Services/printers.service';
import { PrintsService } from '../../Prints/Services/prints.service';
import { EventLoggerService } from '../../Logger/event-logger.service';
import { LogEvents } from '../../Logger/logger.constants';

interface SetResponseOutcome {
  printjobid: string;
  success: boolean;
  failureCode?: string;
}

const responseFileParser = new XMLParser({ ignoreAttributes: false });

/** §5.3 — orchestrates the two `ConnectionType` flows the printer itself calls. */
@Injectable()
export class CloudService {
  private readonly logger = new Logger(CloudService.name);

  constructor(
    private readonly printersService: PrintersService,
    private readonly printsService: PrintsService,
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

    const jobInputs = await this.printsService.dequeueForPrinter(printer);
    if (jobInputs.length === 0) {
      return null;
    }

    return this.printsService.buildPrintRequestXml(jobInputs);
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
      await this.printsService.recordSetResponseOutcome(
        outcome.printjobid,
        outcome.success,
        outcome.failureCode,
      );
    }
  }

  /**
   * Parses the printer's `<PrintResponseInfo>` document (§2/§5.3) into per-job
   * outcomes. FINAL_SPEC.md doesn't pin an exact schema for this document (unlike
   * the GetRequest envelope in §9.1), so this follows Epson's documented
   * ePOS-Print SDP response shape: one `<ePOSPrintResponse>` per job, each
   * carrying its `printjobid` and a `success`/`code` pair.
   */
  private parseResponseFile(xml: string): SetResponseOutcome[] {
    const parsed = responseFileParser.parse(xml);
    const root = parsed?.PrintResponseInfo;
    if (!root?.ePOSPrintResponse) {
      return [];
    }

    const entries = Array.isArray(root.ePOSPrintResponse)
      ? root.ePOSPrintResponse
      : [root.ePOSPrintResponse];

    return entries
      .map((entry: Record<string, any>) => ({
        printjobid: entry?.Parameter?.printjobid,
        success: String(entry?.success).toLowerCase() === 'true',
        failureCode:
          String(entry?.success).toLowerCase() === 'true'
            ? undefined
            : entry?.code,
      }))
      .filter((outcome: SetResponseOutcome) => Boolean(outcome.printjobid));
  }
}
