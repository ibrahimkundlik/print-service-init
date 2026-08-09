import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CloudService } from '../Services/cloud.service';
import { DeviceAuthGuard } from '../Guards/device-auth.guard';
import { Printer } from '../../Printers/Schemas/printer.schema';

interface SdpRequestBody {
  ID: string;
  ConnectionType: 'GetRequest' | 'SetResponse';
  ResponseFile?: string;
}

@Controller('api/cloud')
@UseGuards(DeviceAuthGuard)
export class CloudController {
  constructor(private readonly cloudService: CloudService) {}

  @Post()
  async handlePoll(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const printer = (request as Request & { printer: Printer }).printer;
    const body = request.body as SdpRequestBody;

    console.log('DEBUG :: handlePoll', { body, pid: printer?._id });

    if (body.ConnectionType === 'SetResponse') {
      await this.cloudService.handleSetResponse(printer, body.ResponseFile);
      response.status(200).end();
      return;
    }

    const xml = await this.cloudService.handleGetRequest(printer);
    if (!xml) {
      response.status(200).end();
      return;
    }

    response.status(200).set('Content-Type', 'text/xml').send(xml);
  }
}
