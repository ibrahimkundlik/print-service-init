import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrintersService } from '../../Printers/Services/printers.service';
import { PrinterStatus } from '../../Printers/Schemas/printer.schema';
import { ClientException } from '../../../Exceptions/ClientException';
import { EventLoggerService } from '../../Logger/event-logger.service';
import { LogEvents } from '../../Logger/logger.constants';

/**
 * §6 — the entire authentication model for `/api/cloud` in v1: look up `printers` by
 * `_id = ID` (the form field the printer itself sends) and reject with `404` if it
 * doesn't exist. No password/Digest Auth check — deliberately deferred, see §6.
 *
 * Also rejects `archived` printers with the same `404` — `DELETE /api/printers`
 * soft-deletes rather than actually removing the document (see PrinterStatus),
 * so this check is what still makes "delete" actually stop a printer from
 * polling, same as real deletion used to.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly printersService: PrintersService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const printerId = request.body?.ID;
    const printerName = request.body?.name;
    const logPayload = { printerId, printerName };

    if (!printerId) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        event: 'MISSING_PRINTER_ID',
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 404,
        message: 'Missing ID field',
        errorCode: 'MISSING_PRINTER_ID',
      });
    }

    let printer: Awaited<ReturnType<PrintersService['findById']>>;

    try {
      printer = await this.printersService.findById(printerId);
    } catch (err) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        event: 'PRINTER_LOOKUP_FAILED',
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 500,
        errorCode: 'PRINTER_LOOKUP_FAILED',
        message: `Failed to look up printer ${printerId}: ${err.message}`,
      });
    }

    if (!printer || printer.status === PrinterStatus.Archived) {
      this.eventLogger.logEvent(LogEvents.PRINTER_POLLING, {
        event: 'PRINTER_NOT_FOUND',
        ...logPayload,
      });

      throw new ClientException({
        statusCode: 404,
        errorCode: 'PRINTER_NOT_FOUND',
        message: `Could not find printer with id: ${printerId}`,
      });
    }

    request.printer = printer;
    return true;
  }
}
