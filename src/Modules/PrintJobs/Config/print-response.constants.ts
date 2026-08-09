export const PRINT_RESPONSE_CODE_MESSAGES: Record<string, string> = {
  EPTR_AUTOMATICAL:
    'Automatically recoverable error occurred due to continuous printing.',
  EPTR_BATTERY_LOW: 'No remaining battery for printer.',
  EPTR_COVER_OPEN: 'Printer cover is open.',
  EPTR_CUTTER: 'Printer autocutter error occurred.',
  EPTR_MECHANICAL: 'Printer mechanical error occurred.',
  EPTR_REC_EMPTY: 'No paper in printer roll paper end sensor.',
  EPTR_UNRECOVERABLE: 'An unrecoverable error occurred for printer.',
  SchemaError: 'Request document contains a syntax error.',
  DeviceNotFound: 'The printer with the specified device ID does not exist.',
  PrintSystemError: 'Error occurred on the printing system.',
  EX_BADPORT: 'Error was detected on printer communication port.',
  EX_TIMEOUT: 'Print timeout error occurred.',
  EX_SPOOLER: 'There is not enough space available in the printing queue.',
  JobNotFound: 'The specified job ID does not exist.',
  Printing: 'Print job is now printing.',
};

interface StatusFlagEntry {
  description: string;
  notApplicable?: boolean;
}

export const PRINT_RESPONSE_STATUS_FLAGS: Record<number, StatusFlagEntry> = {
  0x00000001: { description: 'No printer response' },
  0x00000002: { description: 'Print complete' },
  0x00000008: { description: 'Offline status' },
  0x00000020: { description: 'Cover is open' },
  0x00000040: { description: 'Paper feed switch is feeding paper' },
  0x00000100: { description: 'Waiting for online recovery' },
  0x00000200: { description: 'Paper feed switch is being pressed' },
  0x00000400: { description: 'Mechanical error occurred' },
  0x00000800: { description: 'Auto cutter error generated' },
  0x00002000: { description: 'Unrecoverable error generated' },
  0x00004000: { description: 'Auto recovery error generated' },
  0x00080000: { description: 'No paper in the roll paper end detector' },
  0x00020000: { description: 'No paper in the roll paper near-end detector' },

  0x00000004: {
    notApplicable: true,
    description:
      'Drawer kick connector pin 3 = "H" | Offline due to weak battery',
  },
  0x01000000: {
    notApplicable: true,
    description: 'Buzzer activated | Waiting for label to be removed',
  },
  0x04000000: {
    notApplicable: true,
    description: 'No paper in label peeling sensor',
  },
};

export function describeResponseCode(code: string | undefined): string | null {
  if (!code) {
    return null;
  }
  return (
    PRINT_RESPONSE_CODE_MESSAGES[code] ?? `Unrecognized error code: ${code}`
  );
}

export function describeResponseStatus(status: number | undefined): string[] {
  try {
    if (!status) {
      return [];
    }

    const flags: string[] = [];
    for (const [bit, entry] of Object.entries(PRINT_RESPONSE_STATUS_FLAGS)) {
      const bitValue = Number(bit);
      if (!entry.notApplicable && (status & bitValue) === bitValue) {
        flags.push(entry.description);
      }
    }

    return flags;
  } catch (err) {
    return [];
  }
}
