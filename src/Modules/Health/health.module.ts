import { Module } from '@nestjs/common';
import { HealthController } from './Controllers/health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
