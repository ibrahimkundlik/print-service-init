import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrintersService } from '../../Printers/Services/printers.service';
import { ClientException } from '../../../Exceptions/ClientException';

/**
 * §6 — the entire authentication model for `/api/cloud` in v1: look up `printers` by
 * `_id = ID` (the form field the printer itself sends) and reject with `404` if it
 * doesn't exist. No password/Digest Auth check — deliberately deferred, see §6.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly printersService: PrintersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const printerId = request.body?.ID;

    if (!printerId) {
      throw new ClientException({
        message: 'Missing ID field',
        errorCode: 'MISSING_PRINTER_ID',
        statusCode: 404,
      });
    }

    const printer = await this.printersService.findById(printerId);
    if (!printer) {
      throw new ClientException({
        message: `Could not find printer with id: ${printerId}`,
        errorCode: 'PRINTER_NOT_FOUND',
        statusCode: 404,
      });
    }

    request.printer = printer;
    return true;
  }
}
