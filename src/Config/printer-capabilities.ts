/**
 * FINAL_SPEC.md §11 — printer capability reference.
 *
 * Two separate lookups, kept apart deliberately (§11 explains why): dot width is a
 * function of the *exact physical model*, while max payload size is a function of
 * *firmware/software version* for the older generic TM-i/TM-DT family. None of the
 * models below are from that older family, so they're all a flat 2MB tier for now —
 * see the note on MAX_PAYLOAD_SIZE_BYTES_DEFAULT before adding a TM-i/TM-DT `-i`/`-DT`
 * suffix model (TM-T20II-i, TM-L90-i, etc.), which would need a firmwareVersion field
 * added to `printers` (§4.1) to size correctly.
 */

export type PrinterModel =
  | 'TM-T88VI'
  | 'TM-T88VI-iHUB'
  | 'TM-T88VII'
  | 'TM-m30II'
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

/**
 * §11.1 — dot width by exact model. Sourced from Epson's own ePOS-Print Editor
 * reference data, EXCEPT TM-m30II, which is corrected to the value we actually
 * verified against real hardware during the POC (the reference value of 576 left a
 * visible blank margin; 640 was confirmed correct). Treat every other row as a
 * starting default, not gospel — spot-check against real hardware when a new model
 * is actually onboarded, and update `printers.printWidthDots` directly rather than
 * this table if a specific unit disagrees.
 */
export const PRINTER_WIDTH_DOTS: Record<PrinterModel, ModelWidthEntry> = {
  'TM-T88VI': { dots: 512, verifiedAgainstRealHardware: true },
  'TM-T88VI-iHUB': { dots: 512, verifiedAgainstRealHardware: false },
  'TM-T88VII': { dots: 512, verifiedAgainstRealHardware: false },
  'TM-m30II': { dots: 640, verifiedAgainstRealHardware: true },
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

/**
 * §11.2 — every model currently in PRINTER_WIDTH_DOTS is a flat 2MB max-payload-size
 * tier (none of them are TM-i/TM-DT firmware-tiered devices), so this takes no
 * `model` argument for now. If a `-i`/`-DT` suffix model is ever added, its tier
 * depends on firmware/software version instead of the model name alone — this will
 * need a real parameter (and probably a `firmwareVersion` field on `printers`, §4.1)
 * at that point; don't just default it to 2MB without checking §11.2 first.
 */
export const MAX_PAYLOAD_SIZE_BYTES_DEFAULT = 2 * 1024 * 1024;

export function getPrintWidthDots(model: PrinterModel): number {
  const entry = PRINTER_WIDTH_DOTS[model];
  if (!entry) {
    throw new Error(
      `No dot-width entry for printer model "${model}" — add one to printer-capabilities.ts (§11.1) before provisioning it.`,
    );
  }
  return entry.dots;
}

export function getMaxPayloadSizeBytes(): number {
  return MAX_PAYLOAD_SIZE_BYTES_DEFAULT;
}
