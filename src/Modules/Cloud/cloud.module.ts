import { Module } from '@nestjs/common';
import { CloudController } from './Controllers/cloud.controller';
import { CloudService } from './Services/cloud.service';
import { DeviceAuthGuard } from './Guards/device-auth.guard';
import { PrintersModule } from '../Printers/printers.module';
import { PrintJobsModule } from '../PrintJobs/print-jobs.module';

@Module({
  imports: [PrintersModule, PrintJobsModule],
  controllers: [CloudController],
  providers: [CloudService, DeviceAuthGuard],
})
export class CloudModule {}
