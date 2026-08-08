import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Printer, PrinterSchema } from './Schemas/printer.schema';
import { PrintersController } from './Controllers/printers.controller';
import { PrintersService } from './Services/printers.service';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Printer.name, schema: PrinterSchema }],
      'mongodb',
    ),
    AuthModule,
  ],
  controllers: [PrintersController],
  providers: [PrintersService],
  exports: [PrintersService],
})
export class PrintersModule {}
