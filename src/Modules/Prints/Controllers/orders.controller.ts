import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PrintsService } from '../Services/prints.service';
import { ingestOrderDto } from '../DTO/ingest-order.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly printsService: PrintsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() order: ingestOrderDto): Promise<void> {
    await this.printsService.ingestOrder(order);
  }
}
