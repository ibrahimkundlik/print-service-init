import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PrintersService } from '../Services/printers.service';
import { createPrinterDto } from '../DTO/create-printer.dto';

/**
 * Admin CRUD for printer provisioning (§5.2). Not called by the printer itself —
 * that's the Cloud module (§5.3).
 */
@Controller('api/printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  /**
   * Create a printer record. Returns everything the ops UI needs to display for
   * copy-paste into WebConfig (§5.2 step 2): the shared Server1 URL and the
   * generated `printerId` (entered as WebConfig's ID field, alone — no password).
   */
  @Post()
  async create(@Body() body: createPrinterDto) {
    const printer = await this.printersService.create(body);
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? '';

    return {
      printer,
      webConfig: {
        server1Url: `${publicBaseUrl}/api/cloud`,
        id: printer._id,
      },
    };
  }

  @Get()
  list(@Query('bizId') bizId?: string) {
    return this.printersService.list(bizId);
  }

  @Get(':printerId')
  async getOne(@Param('printerId') printerId: string) {
    const printer = await this.printersService.findById(printerId);
    if (!printer) {
      throw new NotFoundException(
        `Could not find printer with id: ${printerId}`,
      );
    }
    return printer;
  }

  /** §6 — there's no separate revoked state; deleting is how you stop a printer polling. */
  @Delete(':printerId')
  remove(@Param('printerId') printerId: string) {
    return this.printersService.remove(printerId);
  }
}
