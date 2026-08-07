export type PrinterModel =
  | 'TM-T88VI'
  | 'TM-T88VI-iHUB'
  | 'TM-T88VII'
  | 'TM-m30II'
  | 'TM-m30II-NT'
  | 'TM-m30III'
  | 'TM-m50'
  | 'TM-m50II'
  | 'TM-T20'
  | 'TM-T20II'
  | 'TM-T20III'
  | 'TM-T82'
  | 'TM-T82III'
  | 'TM-L100';

interface ModelWidthEntry {
  dots: number;
  verifiedAgainstRealHardware: boolean;
}

export const PRINTER_WIDTH_DOTS: Record<PrinterModel, ModelWidthEntry> = {
  'TM-T88VI': { dots: 512, verifiedAgainstRealHardware: true },
  'TM-m30II': { dots: 576, verifiedAgainstRealHardware: true },
  'TM-m30II-NT': { dots: 576, verifiedAgainstRealHardware: true },

  'TM-T88VI-iHUB': { dots: 512, verifiedAgainstRealHardware: false },
  'TM-T88VII': { dots: 512, verifiedAgainstRealHardware: false },
  'TM-m30III': { dots: 576, verifiedAgainstRealHardware: false },
  'TM-m50': { dots: 512, verifiedAgainstRealHardware: false },
  'TM-m50II': { dots: 512, verifiedAgainstRealHardware: false },
  'TM-T20': { dots: 576, verifiedAgainstRealHardware: false },
  'TM-T20II': { dots: 576, verifiedAgainstRealHardware: false },
  'TM-T20III': { dots: 576, verifiedAgainstRealHardware: false },
  'TM-T82': { dots: 576, verifiedAgainstRealHardware: false },
  'TM-T82III': { dots: 576, verifiedAgainstRealHardware: false },
  'TM-L100': { dots: 576, verifiedAgainstRealHardware: false },
};

export const MAX_PAYLOAD_SIZE_BYTES_DEFAULT = 2 * 1024 * 1024;

export function getPrintWidthDots(model: PrinterModel): number {
  const entry = PRINTER_WIDTH_DOTS[model];
  if (!entry) {
    throw new Error(
      `No dot-width entry for printer model "${model}", add one to printer-capabilities.ts before provisioning it.`,
    );
  }
  return entry.dots;
}

export function getMaxPayloadSizeBytes(): number {
  return MAX_PAYLOAD_SIZE_BYTES_DEFAULT;
}
