import * as puppeteer from 'puppeteer';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * Renders bill/KOT HTML to a PNG at a given dot width (§9.3 step 2). Two gotchas
 * here directly affect output *correctness*, not just performance — both were found
 * the hard way against real hardware during the POC:
 *
 * - The bill HTML hardcodes `max-width: 80mm` regardless of requested width, which
 *   silently caps rendered content at ~302px and leaves the rest blank — this
 *   produced a real physical blank margin on printed receipts. Overridden below via
 *   `addStyleTag`.
 * - The bill HTML sets `background: transparent`, which otherwise falls back to
 *   Chromium's dark-mode default page background — this printed as a solid black
 *   rectangle before forcing light-mode emulation below.
 *
 * Also: launching a fresh Chromium instance per call took ~1.4-1.7s in the POC —
 * long enough that a real printer's HTTP client timed out waiting on the response
 * and retried in a tight loop. One browser instance is kept alive for the life of
 * this service instead; only pages are created/closed per render.
 */
@Injectable()
export class HtmlToPngService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlToPngService.name);
  private browserPromise: Promise<puppeteer.Browser> | null = null;

  private getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({ headless: true });
    }
    return this.browserPromise;
  }

  async render(html: string, width: number): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
      ]);
      await page.setViewport({ width, height: 100 });
      // No external resources in the bill HTML, so there's nothing to wait on
      // beyond the DOM itself being parsed.
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.addStyleTag({
        content: 'html, body { max-width: none !important; }',
      });
      const screenshot = await page.screenshot({ type: 'png', fullPage: true });
      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
    }
  }
}
