import { Controller, Get, Param } from '@nestjs/common';
import { PrintsService } from '../Services/prints.service';
import { Print } from '../Schemas/print.schema';

@Controller('api/jobs')
export class JobsController {
  constructor(private readonly printsService: PrintsService) {}

  /** §5.4 — unchanged from earlier spec revisions, still `/api/jobs/:jobId`. */
  @Get(':jobId')
  async getStatus(@Param('jobId') jobId: string): Promise<Print> {
    return this.printsService.getJobStatus(jobId);
  }
}
