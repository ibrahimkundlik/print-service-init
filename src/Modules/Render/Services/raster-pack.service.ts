import * as sharp from 'sharp';
import { Injectable } from '@nestjs/common';

export interface PackedRaster {
  base64: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Packs 8-bit grayscale pixels into Epson's mono raster format: 1 bit/pixel, MSB
 * first, black = 1 / white = 0, each row zero-padded to a byte boundary (§9.3 steps
 * 4-6). Gray16 is dropped entirely per FINAL_SPEC.md §9.3/§11.2 — only a minority of
 * models support it and it's not needed here.
 */
function packMono(pixels: Buffer, width: number, height: number): Buffer {
  const rowBytes = Math.ceil(width / 8);
  const out = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x] < 128) {
        const byteIndex = rowBytes * y + (x >> 3);
        const bitPosition = 7 - (x % 8);
        out[byteIndex] |= 1 << bitPosition;
      }
    }
  }

  return out;
}

@Injectable()
export class RasterPackService {
  /**
   * Converts a rendered PNG into a packed mono raster (§9.3 steps 3-7): resize to
   * the target dot width, flatten/grayscale, then bit-pack.
   */
  async pack(pngBuffer: Buffer, widthDots: number): Promise<PackedRaster> {
    const { data, info } = await sharp(pngBuffer)
      .resize({ width: widthDots })
      .flatten({ background: '#ffffff' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const packed = packMono(data, info.width, info.height);

    return {
      base64: packed.toString('base64'),
      widthPx: info.width,
      heightPx: info.height,
    };
  }
}
