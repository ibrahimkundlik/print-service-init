import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PrintJobsService } from '../Services/print-jobs.service';
import { ingestOrderDto } from '../DTO/ingest-order.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() order: ingestOrderDto): Promise<void> {
    await this.printJobsService.ingestOrder(order);
  }
}
