import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PrintersService } from '../Services/printers.service';
import { createPrinterDto } from '../DTO/create-printer.dto';
import { updatePrinterDto } from '../DTO/update-printer.dto';
import { listPrintersDto } from '../DTO/list-printers.dto';
import { archivePrinterDto } from '../DTO/archive-printer.dto';
import { AuthGuard } from '../../Auth/Guards/auth.guard';

interface PrimeAuthoritiesResponse {
  data: {
    user: {
      id: number;
      username?: string;
      [key: string]: unknown;
    };
  };
}

function getPrimeUser(
  request: Request,
): PrimeAuthoritiesResponse['data']['user'] {
  return (request as Request & { user: PrimeAuthoritiesResponse }).user?.data
    ?.user;
}

function getActorIdentifier(request: Request): string {
  const user = getPrimeUser(request);
  return user?.username ?? String(user?.id);
}

/**
 * Admin CRUD for printer provisioning. Every route requires a valid Prime bearer token.
 *
 */
@Controller('api/printers')
@UseGuards(AuthGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Post()
  async create(@Body() body: createPrinterDto, @Req() request: Request) {
    const printer = await this.printersService.create(
      body,
      getActorIdentifier(request),
    );
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? '';

    return {
      printer,
      webConfig: {
        id: printer._id,
        url: `${publicBaseUrl}/api/cloud`,
      },
    };
  }

  @Post('list')
  @HttpCode(HttpStatus.OK)
  list(@Body() body: listPrintersDto) {
    return this.printersService.list(body);
  }

  @Patch(':printerId')
  update(
    @Param('printerId') printerId: string,
    @Body() body: updatePrinterDto,
    @Req() request: Request,
  ) {
    return this.printersService.update(
      printerId,
      body,
      getActorIdentifier(request),
    );
  }

  @Patch(':printerId/archive')
  archive(
    @Param('printerId') printerId: string,
    @Body() body: archivePrinterDto,
    @Req() request: Request,
  ) {
    return this.printersService.archive(
      printerId,
      body,
      getActorIdentifier(request),
    );
  }
}
