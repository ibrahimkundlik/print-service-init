import { Injectable } from '@nestjs/common';

export interface EposPrintJobInput {
  printjobid: string;
  packedBase64: string;
  widthPx: number;
  heightPx: number;
}

export const EPOS_PRINT_XML_OVERHEAD_BYTES = 500;
const EPOS_PRINT_XMLNS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';

/**
 * Assembles the ePOS-Print XML envelope (§9.1, §9.2) — one <PrintRequestInfo> wrapping
 * one <ePOSPrint> block per job/copy for this poll. `devid` is a fixed "local_printer"
 * (matches every sample in Epson's own SDP reference docs for a single locally-attached
 * printer), not derived per-printer.
 */
@Injectable()
export class EposXmlBuilderService {
  buildPrintRequestInfo(jobs: EposPrintJobInput[]): string {
    const blocks = jobs.map((job) => this.buildEposPrintBlock(job)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<PrintRequestInfo Version="2.00">\n${blocks}\n</PrintRequestInfo>\n`;
  }

  private buildEposPrintBlock(job: EposPrintJobInput): string {
    return `
    <ePOSPrint>
      <Parameter>
        <devid>local_printer</devid>
        <timeout>10000</timeout>
        <printjobid>${job.printjobid}</printjobid>
      </Parameter>
      <PrintData>
        <epos-print xmlns="${EPOS_PRINT_XMLNS}">
          <image width="${job.widthPx}" height="${job.heightPx}" mode="mono">${job.packedBase64}</image>
          <cut type="feed"/>
        </epos-print>
      </PrintData>
    </ePOSPrint>`;
  }
}
