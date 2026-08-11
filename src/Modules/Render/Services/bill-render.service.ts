import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BillHtmlService } from './bill-html.service';
import { HtmlToPngService } from './html-to-png.service';
import { RasterPackService, PackedRaster } from './raster-pack.service';
import { PrintType } from '../../Printers/Schemas/printer.schema';
import {
  PrimeApiService,
  PrintTemplatesResponse,
} from '../../PrimeApi/Services/prime-api.service';
import { getPrintTemplateConfig } from '../Config/print-template-resolver';

const TEMPLATE_CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class BillRenderService {
  private readonly logger = new Logger(BillRenderService.name);

  constructor(
    private readonly billHtmlService: BillHtmlService,
    private readonly htmlToPngService: HtmlToPngService,
    private readonly rasterPackService: RasterPackService,
    private readonly primeApiService: PrimeApiService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async renderAndPack(
    order: unknown,
    printType: PrintType,
    widthDots: number,
    title: string,
    primeBizId: number,
    locationId: number,
  ): Promise<PackedRaster> {
    const template = await this.resolveTemplate(
      primeBizId,
      printType,
      locationId,
    );
    const html = this.billHtmlService.render(order, printType, title, template);
    const png = await this.htmlToPngService.render(html, widthDots);
    return this.rasterPackService.pack(png, widthDots);
  }

  private async resolveTemplate(
    primeBizId: number,
    printType: PrintType,
    locationId: number,
  ): Promise<unknown> {
    const cacheKey = `print_templates_${primeBizId}`;
    let templatesResponse =
      await this.cacheManager.get<PrintTemplatesResponse>(cacheKey);

    if (!templatesResponse) {
      try {
        templatesResponse =
          await this.primeApiService.getPrintTemplates(primeBizId);
        await this.cacheManager.set(
          cacheKey,
          templatesResponse,
          TEMPLATE_CACHE_TTL_MS,
        );
      } catch (err) {
        this.logger.log('DEBUG :: BillRenderService resolveTemplate', {
          primeBizId,
          message: `Falling back to default template: ${err.message}`,
        });
        return getPrintTemplateConfig(printType);
      }
    }

    return getPrintTemplateConfig(
      printType,
      locationId,
      templatesResponse?.data,
    );
  }
}
