import { Injectable } from '@nestjs/common';
import { BillHtmlService } from './bill-html.service';
import { HtmlToPngService } from './html-to-png.service';
import { RasterPackService, PackedRaster } from './raster-pack.service';
import { PrintType } from '../../Printers/Schemas/printer.schema';

/**
 * The full order -> bill/KOT HTML -> PNG -> packed raster pipeline (§9.3), run once
 * per resolved printer at ingest/fan-out time (§5.1) — never on a GetRequest
 * delivery. See the individual services for the specific gotchas each step guards
 * against.
 */
@Injectable()
export class BillRenderService {
  constructor(
    private readonly billHtmlService: BillHtmlService,
    private readonly htmlToPngService: HtmlToPngService,
    private readonly rasterPackService: RasterPackService,
  ) {}

  async renderAndPack(
    order: unknown,
    printType: PrintType,
    widthDots: number,
    title: string,
  ): Promise<PackedRaster> {
    const html = this.billHtmlService.render(order, printType, title);
    const png = await this.htmlToPngService.render(html, widthDots);
    return this.rasterPackService.pack(png, widthDots);
  }
}
