import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './Services/auth.service';
import { AuthGuard } from './Guards/auth.guard';

@Module({
  imports: [HttpModule],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
