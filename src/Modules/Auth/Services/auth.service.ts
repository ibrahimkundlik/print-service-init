import { HttpService } from '@nestjs/axios';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { catchError, lastValueFrom } from 'rxjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async validatePrimeApiToken(token: string): Promise<boolean> {
    const data = await this.getPrimeUserDetails(token);
    return !!Object.keys(data).length;
  }

  async getPrimeUserDetails(token: string): Promise<any> {
    const cacheKey = 'user_' + token;
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const url =
      this.configService.get<string>('PRIME_API_URL') + '/users/authorities/v2';

    try {
      const { data } = await lastValueFrom(
        this.httpService
          .get(url, { headers: { Authorization: `Bearer ${token}` } })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.log('DEBUG :: AuthService Pipe Err', {
                error: error,
              });
              throw new UnauthorizedException();
            }),
          ),
      );

      await this.cacheManager.set(cacheKey, data, 300000);
      return data;
    } catch (e) {
      this.logger.log('DEBUG :: AuthService Err', { error: e });
      throw new UnauthorizedException();
    }
  }
}
