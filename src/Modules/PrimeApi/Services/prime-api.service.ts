import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { catchError, lastValueFrom } from 'rxjs';
import { PrintType } from '../../Printers/Schemas/printer.schema';

export interface PrintFailureEmailPayload {
  company_id: number;
  order_id: number;
  type: PrintType;
  printer_label: string;
  recipient_email: string;
}

export interface PrintTemplateEntry {
  location_ids?: number[];
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PrintTemplatesResponse {
  data: {
    order_invoice_templates?: PrintTemplateEntry[];
    order_kot_templates?: PrintTemplateEntry[];
    order_invoice_default_config?: Record<string, unknown>;
    order_kot_default_config?: Record<string, unknown>;
    brand_logos?: unknown;
  };
}

@Injectable()
export class PrimeApiService {
  private readonly logger = new Logger(PrimeApiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private getBaseUrl(): string {
    return `${this.configService.get<string>('PRIME_API_URL')}/api/v1/external/print-service`;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.configService.get<string>('PRIME_OUTGOING_AUTH_TOKEN');
    return { Authorization: `Bearer ${token}` };
  }

  async getPrintTemplates(companyId: number): Promise<PrintTemplatesResponse> {
    const url = `${this.getBaseUrl()}/print-templates`;

    const { data } = await lastValueFrom(
      this.httpService
        .get(url, {
          headers: this.getAuthHeaders(),
          params: { company_id: companyId },
        })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.log('DEBUG :: PrimeApiService getPrintTemplates', {
              companyId,
              error: error?.message,
            });
            throw error;
          }),
        ),
    );

    return data;
  }

  async sendPrintFailureEmail(
    payload: PrintFailureEmailPayload,
  ): Promise<void> {
    const url = `${this.getBaseUrl()}/print-failure-email`;

    await lastValueFrom(
      this.httpService
        .post(url, payload, { headers: this.getAuthHeaders() })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.log('DEBUG :: PrimeApiService sendPrintFailureEmail', {
              payload,
              error: error?.message,
            });
            throw error;
          }),
        ),
    );
  }
}
