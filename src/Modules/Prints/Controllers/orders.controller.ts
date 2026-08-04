import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PrintsService } from '../Services/prints.service';
import { ingestOrderDto } from '../DTO/ingest-order.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly printsService: PrintsService) {}

  /**
   * §5.1 — ingest a raw order payload, fan it out to every matching printer, render
   * + queue one job per match, and return their ids. 404 if no non-pending printer
   * matches this order's bizId/locationId; 400 if rendering fails.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(@Body() order: ingestOrderDto): Promise<{ jobIds: string[] }> {
    const jobIds = await this.printsService.ingestOrder(order);
    return { jobIds };
  }
}
