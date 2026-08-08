import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../Services/auth.service';

export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>() as Request & {
      user: any;
    };

    const isPublic = Reflect.getMetadata('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    try {
      const isUserAuthenticated = await this.isAuthenticated(request);
      if (isUserAuthenticated) {
        const token = this.extractTokenFromHeader(request);
        const user = await this.authService.getPrimeUserDetails(token);
        request.user = user;
        return true;
      }
    } catch (e) {
      this.logger.log('DEBUG :: AuthGuard Err', { error: e });
    }

    this.logger.log('DEBUG :: AuthGuard Failed', {
      headers: request.headers,
    });

    return false;
  }

  isAuthenticated(request: Request): Promise<boolean> {
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Authorization token is missing');
    }
    return this.authService.validatePrimeApiToken(token);
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
