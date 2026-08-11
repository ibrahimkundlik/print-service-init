import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrintJobsService } from '../Services/print-jobs.service';
import { ingestOrderDto } from '../DTO/ingest-order.dto';
import { PrimeIncomingAuthGuard } from '../Guards/prime-incoming-auth.guard';

@Controller('api/orders')
@UseGuards(PrimeIncomingAuthGuard)
export class OrdersController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() order: ingestOrderDto): Promise<void> {
    await this.printJobsService.ingestOrder(order);
  }
}
