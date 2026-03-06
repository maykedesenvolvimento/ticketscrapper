import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from '../scraper/scraper.service';
import { TicketsService } from './tickets.service';

/**
 * Scheduled sync: scrape + persist on the interval defined by SCRAPER_CRON.
 * Lives in TicketsModule so it can access both ScraperService and TicketsService
 * without introducing a circular dependency.
 */
@Injectable()
export class SyncScheduler {
    private readonly logger = new Logger(SyncScheduler.name);

    constructor(
        private readonly scraperService: ScraperService,
        private readonly ticketsService: TicketsService,
    ) { }

    @Cron(process.env.SCRAPER_CRON ?? '0 */6 * * *', {
        name: 'ticket-sync',
    })
    async handleCron(): Promise<void> {
        this.logger.log('Scheduled sync started');
        const result = await this.scraperService.scrape();

        if (!result.success) {
            this.logger.error(`Sync failed: ${result.error}`);
            return;
        }

        const upserted = await this.ticketsService.upsertMany(result.tickets);
        this.logger.log(
            `Sync completed — ${result.tickets.length} scraped, ${upserted} upserted at ${result.scrapedAt.toISOString()}`,
        );
    }
}
