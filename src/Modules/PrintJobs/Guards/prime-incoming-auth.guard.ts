import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientException } from '../../../Exceptions/ClientException';
import { EventLoggerService } from '../../Logger/event-logger.service';
import { LogEvents } from '../../Logger/logger.constants';

@Injectable()
export class PrimeIncomingAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'MISSING_AUTH_TOKEN',
      });

      throw new ClientException({
        statusCode: 401,
        errorCode: 'MISSING_AUTH_TOKEN',
        message: 'Missing bearer token',
      });
    }

    const expectedToken = this.configService.get<string>(
      'PRIME_INCOMING_AUTH_TOKEN',
    );

    if (!expectedToken || token !== expectedToken) {
      this.eventLogger.logEvent(LogEvents.ORDER_INGESTION, {
        event: 'INVALID_AUTH_TOKEN',
      });

      throw new ClientException({
        statusCode: 401,
        errorCode: 'INVALID_AUTH_TOKEN',
        message: 'Invalid bearer token',
      });
    }

    return true;
  }
}
