import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, BrowserContext, Page, Response } from 'playwright';

export interface RawTicket {
  [key: string]: unknown;
}

export interface ScrapeResult {
  success: boolean;
  tickets: RawTicket[];
  scrapedAt: Date;
  error?: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly configService: ConfigService) {}

  async scrape(): Promise<ScrapeResult> {
    const scrapedAt = new Date();
    let browser: Browser | null = null;

    try {
      browser = await this.launchBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();

      await this.login(page);
      const tickets = await this.fetchTickets(page);

      this.logger.log(`Scrape completed — ${tickets.length} ticket(s) found`);

      return { success: true, tickets, scrapedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scrape failed: ${message}`);
      return { success: false, tickets: [], scrapedAt, error: message };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async launchBrowser(): Promise<Browser> {
    this.logger.debug('Launching Chromium (headless)');
    return chromium.launch({ headless: true });
  }

  private async login(page: Page): Promise<void> {
    const loginUrl = this.configService.get<string>('virtualif.loginUrl');
    const username = this.configService.get<string>('virtualif.username');
    const password = this.configService.get<string>('virtualif.password');

    if (!loginUrl || !username || !password) {
      throw new Error(
        'Missing VirtualIF credentials in environment variables.',
      );
    }

    this.logger.debug(`Navigating to login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // TODO: update selectors to match VirtualIF's actual login form
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle' });
    this.logger.debug('Login successful');
  }

  private async fetchTickets(page: Page): Promise<RawTicket[]> {
    const ticketsUrl = this.configService.get<string>('virtualif.ticketsUrl');

    if (!ticketsUrl) {
      throw new Error('Missing VIRTUALIF_TICKETS_URL in environment variables.');
    }

    return new Promise(async (resolve, reject) => {
      const collected: RawTicket[] = [];
      let resolved = false;

      // Intercept network responses that likely carry the tickets payload
      page.on('response', async (response: Response) => {
        try {
          if (!this.isTicketsResponse(response, ticketsUrl)) return;

          const contentType = response.headers()['content-type'] ?? '';
          if (!contentType.includes('application/json')) return;

          const body = await response.json();
          const tickets = this.extractTicketsFromPayload(body);
          collected.push(...tickets);

          this.logger.debug(
            `Intercepted response from ${response.url()} — ${tickets.length} ticket(s)`,
          );
        } catch (err) {
          this.logger.warn(`Could not parse response: ${String(err)}`);
        }
      });

      try {
        this.logger.debug(`Navigating to tickets page: ${ticketsUrl}`);
        await page.goto(ticketsUrl, { waitUntil: 'networkidle' });

        // Give extra time for any deferred XHR/fetch calls to settle
        await page.waitForTimeout(2000);

        resolved = true;
        resolve(collected);
      } catch (err) {
        if (!resolved) reject(err);
      }
    });
  }

  /**
   * Returns true when the response URL is related to the tickets endpoint.
   * Adjust the matching logic once the exact API URL is known.
   */
  private isTicketsResponse(response: Response, ticketsUrl: string): boolean {
    const responseUrl = response.url();
    return (
      responseUrl.includes(ticketsUrl) ||
      responseUrl.includes('/tickets') ||
      responseUrl.includes('/chamados') ||
      responseUrl.includes('/suporte')
    );
  }

  /**
   * Normalises the raw JSON payload into an array of ticket objects.
   * Adjust the extraction logic to match VirtualIF's actual response shape.
   *
   * Common patterns:
   *   { data: [...] }
   *   { tickets: [...] }
   *   { result: { items: [...] } }
   *   [...]  (bare array)
   */
  private extractTicketsFromPayload(body: unknown): RawTicket[] {
    if (Array.isArray(body)) return body as RawTicket[];

    if (typeof body === 'object' && body !== null) {
      const obj = body as Record<string, unknown>;
      if (Array.isArray(obj['data'])) return obj['data'] as RawTicket[];
      if (Array.isArray(obj['tickets'])) return obj['tickets'] as RawTicket[];
      if (Array.isArray(obj['chamados'])) return obj['chamados'] as RawTicket[];
      if (
        typeof obj['result'] === 'object' &&
        obj['result'] !== null &&
        Array.isArray((obj['result'] as Record<string, unknown>)['items'])
      ) {
        return (obj['result'] as Record<string, unknown>)[
          'items'
        ] as RawTicket[];
      }
    }

    this.logger.warn(
      'Could not extract tickets array from response — returning raw body as single item',
    );
    return [body as RawTicket];
  }
}
