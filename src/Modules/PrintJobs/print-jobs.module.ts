import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrintJob, PrintJobSchema } from './Schemas/print-job.schema';
import { OrdersController } from './Controllers/orders.controller';
import { JobsController } from './Controllers/jobs.controller';
import { PrintJobsService } from './Services/print-jobs.service';
import { PrintersModule } from '../Printers/printers.module';
import { RenderModule } from '../Render/render.module';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: PrintJob.name, schema: PrintJobSchema }],
      'mongodb',
    ),
    PrintersModule,
    RenderModule,
    AuthModule,
  ],
  controllers: [OrdersController, JobsController],
  providers: [PrintJobsService],
  exports: [PrintJobsService],
})
export class PrintJobsModule {}
