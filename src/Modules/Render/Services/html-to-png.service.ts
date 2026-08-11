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
 *
 * Self-healing: that one long-lived browser can still crash mid-service-lifetime
 * (OOM, Chromium update, etc. — hit for real in practice, not just theoretical) —
 * without recovery, `browserPromise` would keep resolving to the dead instance
 * forever and every render() after that would fail identically until the whole
 * Node process was restarted. Two layers guard against that: `getBrowser()`
 * health-checks the cached instance and relaunches if it's died since last use,
 * and `render()` retries once against a freshly-launched browser if the browser
 * dies *during* the render itself (the narrower race the health check can't catch).
 */
@Injectable()
export class HtmlToPngService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlToPngService.name);
  private browserPromise: Promise<puppeteer.Browser> | null = null;

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      if (browser.isConnected()) {
        return browser;
      }
      this.logger.warn('Cached Puppeteer browser is disconnected, relaunching');
      this.browserPromise = null;
    }

    this.browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    return this.browserPromise;
  }

  async render(html: string, width: number): Promise<Buffer> {
    try {
      return await this.renderOnce(html, width);
    } catch (err) {
      if (!this.isBrowserConnectionError(err)) {
        throw err;
      }
      this.logger.warn(
        `Puppeteer browser connection lost mid-render, relaunching and retrying once: ${err.message}`,
      );
      this.browserPromise = null;
      return this.renderOnce(html, width);
    }
  }

  private async renderOnce(html: string, width: number): Promise<Buffer> {
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

  /** Puppeteer's own error messages for "the browser process is gone" — no typed error class for this. */
  private isBrowserConnectionError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes('Protocol error') ||
      message.includes('Connection closed') ||
      message.includes('Target closed') ||
      message.includes('Session closed')
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
    }
  }
}
