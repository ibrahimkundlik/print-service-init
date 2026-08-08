export type PrinterModel =
  | 'TM-T88VI'
  | 'TM-T88VI-iHUB'
  | 'TM-T88VII'
  | 'TM-m30II-SL'
  | 'TM-m30II-NT'
  | 'TM-m30III'
  | 'TM-m50'
  | 'TM-m50II';

interface PrinterDetailsEntry {
  dots: number;
  maxPayloadSizeBytes: number;
  verifiedAgainstRealHardware: boolean;
}

const TWO_MB = 2 * 1024 * 1024;

export const PRINTER_DETAILS: Record<PrinterModel, PrinterDetailsEntry> = {
  'TM-T88VI': {
    dots: 512,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: true,
  },
  'TM-T88VI-iHUB': {
    dots: 512,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: false,
  },
  'TM-T88VII': {
    dots: 512,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: false,
  },

  'TM-m30II-SL': {
    dots: 576,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: true,
  },
  'TM-m30II-NT': {
    dots: 576,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: true,
  },

  'TM-m30III': {
    dots: 576,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: false,
  },

  'TM-m50': {
    dots: 512,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: false,
  },
  'TM-m50II': {
    dots: 512,
    maxPayloadSizeBytes: TWO_MB,
    verifiedAgainstRealHardware: false,
  },
};

function getPrinterDetails(model: PrinterModel): PrinterDetailsEntry {
  const entry = PRINTER_DETAILS[model];
  if (!entry) {
    throw new Error(
      `No printer-details entry for model "${model}", add one to printer-capabilities.ts before provisioning it.`,
    );
  }
  return entry;
}

export function getPrintWidthDots(model: PrinterModel): number {
  return getPrinterDetails(model).dots;
}

export function getMaxPayloadSizeBytes(model: PrinterModel): number {
  return getPrinterDetails(model).maxPayloadSizeBytes;
}
