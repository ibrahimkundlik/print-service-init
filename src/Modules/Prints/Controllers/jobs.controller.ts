import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PrintsService } from '../Services/prints.service';
import { Print } from '../Schemas/print.schema';
import { AuthGuard } from '../../Auth/Guards/auth.guard';

@Controller('api/jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly printsService: PrintsService) {}

  @Get(':printerId')
  async getAllJobs(@Param('printerId') printerId: string): Promise<Print[]> {
    return this.printsService.getAllJobsForPrinter(printerId);
  }
}
