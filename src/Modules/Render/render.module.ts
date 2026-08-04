import { Module } from '@nestjs/common';
import { BillHtmlService } from './Services/bill-html.service';
import { HtmlToPngService } from './Services/html-to-png.service';
import { RasterPackService } from './Services/raster-pack.service';
import { BillRenderService } from './Services/bill-render.service';
import { EposXmlBuilderService } from './Services/epos-xml-builder.service';

@Module({
  providers: [
    BillHtmlService,
    HtmlToPngService,
    RasterPackService,
    BillRenderService,
    EposXmlBuilderService,
  ],
  exports: [BillRenderService, EposXmlBuilderService],
})
export class RenderModule {}
