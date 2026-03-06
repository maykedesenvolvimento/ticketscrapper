import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';

/**
 * ScraperScheduler is intentionally kept inside ScraperModule without any
 * reference to TicketsService to avoid circular dependencies.
 * Scheduled scrapes log results; persistence is handled by TicketsModule's
 * SyncScheduler which lives alongside TicketsService.
 */
@Injectable()
export class ScraperScheduler {
    private readonly logger = new Logger(ScraperScheduler.name);

    constructor(private readonly scraperService: ScraperService) { }

    /** Exposed so SyncScheduler can reuse the same cron-triggered logic. */
    async runScrape() {
        this.logger.log('Scrape triggered');
        return this.scraperService.scrape();
    }
}
