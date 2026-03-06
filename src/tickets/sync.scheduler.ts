import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { TicketsService } from './tickets.service';

/**
 * Scheduled sync: scrape + persist on the interval defined by SCRAPER_CRON.
 * Also runs once immediately on application bootstrap so the first
 * sync doesn't have to wait for the cron interval.
 */
@Injectable()
export class SyncScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(SyncScheduler.name);

    constructor(
        private readonly scraperService: ScraperService,
        private readonly ticketsService: TicketsService,
    ) { }

    /** Runs once when the application finishes bootstrapping. */
    async onApplicationBootstrap(): Promise<void> {
        this.logger.log('Initial sync on startup...');
        await this.sync();
    }

    @Cron(process.env.SCRAPER_CRON ?? '0 */6 * * *', {
        name: 'ticket-sync',
    })
    async handleCron(): Promise<void> {
        this.logger.log('Scheduled sync started');
        await this.sync();
    }

    private async sync(): Promise<void> {
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
