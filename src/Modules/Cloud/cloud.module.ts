import { Module } from '@nestjs/common';
import { CloudController } from './Controllers/cloud.controller';
import { CloudService } from './Services/cloud.service';
import { DeviceAuthGuard } from './Guards/device-auth.guard';
import { PrintersModule } from '../Printers/printers.module';
import { PrintsModule } from '../Prints/prints.module';

@Module({
  imports: [PrintersModule, PrintsModule],
  controllers: [CloudController],
  providers: [CloudService, DeviceAuthGuard],
})
export class CloudModule {}
