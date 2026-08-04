import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Print, PrintSchema } from './Schemas/print.schema';
import { OrdersController } from './Controllers/orders.controller';
import { JobsController } from './Controllers/jobs.controller';
import { PrintsService } from './Services/prints.service';
import { PrintersModule } from '../Printers/printers.module';
import { RenderModule } from '../Render/render.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Print.name, schema: PrintSchema }],
      'mongodb',
    ),
    PrintersModule,
    RenderModule,
  ],
  controllers: [OrdersController, JobsController],
  providers: [PrintsService],
  exports: [PrintsService],
})
export class PrintsModule {}
