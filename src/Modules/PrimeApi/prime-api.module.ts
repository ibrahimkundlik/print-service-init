import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrimeApiService } from './Services/prime-api.service';

@Module({
  imports: [HttpModule],
  providers: [PrimeApiService],
  exports: [PrimeApiService],
})
export class PrimeApiModule {}
