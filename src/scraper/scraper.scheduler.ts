import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ScraperService } from './scraper.service';

@Injectable()
export class ScraperScheduler {
  private readonly logger = new Logger(ScraperScheduler.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Runs on the cron expression defined by SCRAPER_CRON (default: every 6 hours).
   * The expression is read at startup; to change it at runtime, restart the app.
   */
  @Cron(process.env.SCRAPER_CRON ?? '0 */6 * * *', {
    name: 'ticket-scraper',
  })
  async handleCron(): Promise<void> {
    this.logger.log('Scheduled scrape triggered');
    const result = await this.scraperService.scrape();

    if (result.success) {
      this.logger.log(
        `Scheduled scrape finished — ${result.tickets.length} ticket(s) at ${result.scrapedAt.toISOString()}`,
      );
    } else {
      this.logger.error(`Scheduled scrape failed: ${result.error}`);
    }
  }
}
