import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PrintJobsService } from '../Services/print-jobs.service';
import { PrintJob } from '../Schemas/print-job.schema';
import { AuthGuard } from '../../Auth/Guards/auth.guard';

@Controller('api/jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Get(':printerId')
  async getAllJobs(@Param('printerId') printerId: string): Promise<PrintJob[]> {
    return this.printJobsService.getAllJobsForPrinter(printerId);
  }
}
