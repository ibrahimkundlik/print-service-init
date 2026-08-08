import {
  Body,
  Controller,
  Delete,
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
import { AuthGuard } from '../../Auth/Guards/auth.guard';

/**
 * The shape of Prime's `/users/authorities/v2` response, as attached to
 * `request.user` by AuthGuard (see auth.service.ts). Prime wraps its own
 * response in a top-level `data` key (`{"data": {"user": {...}}}`), and
 * `AuthService.getPrimeUserDetails` returns that envelope as-is (mirrors
 * prime-dr3, which does the same `data.user` unwrap at every call site) — so
 * `request.user` is this whole envelope, not the user object directly.
 *
 * Mirrors prime-dr3's own usage of this endpoint: AuthGuard only answers "is
 * this a valid, currently-logged-in Prime user, yes or no" — it doesn't drive
 * any authorization decisions here. `id` is the one field still read (for
 * `createdBy` on create); admin-vs-non-admin filtering for `list()` is decided
 * by Prime web itself and passed in the request body instead (see
 * list-printers.dto.ts).
 */
interface PrimeAuthoritiesResponse {
  data: {
    user: {
      id: number;
      [key: string]: unknown;
    };
  };
}

function getPrimeUser(
  request: Request,
): PrimeAuthoritiesResponse['data']['user'] {
  return (request as Request & { user: PrimeAuthoritiesResponse }).user.data
    .user;
}

/**
 * Admin CRUD for printer provisioning. Every route requires a valid Prime bearer
 * token (AuthGuard) — not called by the printer itself, that's the Cloud module's
 * separate DeviceAuthGuard.
 */
@Controller('api/printers')
@UseGuards(AuthGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Post()
  async create(@Body() body: createPrinterDto, @Req() request: Request) {
    const user = getPrimeUser(request);
    const printer = await this.printersService.create(body, user.id);
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? '';

    return {
      printer,
      webConfig: {
        server1Url: `${publicBaseUrl}/api/cloud`,
        id: printer._id,
      },
    };
  }

  /**
   * POST (not GET) since Prime web needs to send a body: `bizId` for admin
   * users (every printer on that biz) or `locationIds` for non-admins (only
   * printers at locations they have access to) — see list-printers.dto.ts.
   */
  @Post('list')
  @HttpCode(HttpStatus.OK)
  list(@Body() body: listPrintersDto) {
    return this.printersService.list(body);
  }

  @Patch(':printerId')
  update(
    @Param('printerId') printerId: string,
    @Body() body: updatePrinterDto,
  ) {
    return this.printersService.update(printerId, body);
  }

  @Delete(':printerId')
  remove(@Param('printerId') printerId: string) {
    return this.printersService.remove(printerId);
  }
}
