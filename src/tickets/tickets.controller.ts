import {
    Controller,
    Get,
    Param,
    Post,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ScraperService } from '../scraper/scraper.service';
import { Ticket } from './ticket.entity';

@Controller('tickets')
export class TicketsController {
    constructor(
        private readonly ticketsService: TicketsService,
        private readonly scraperService: ScraperService,
    ) { }

    /** GET /tickets — all persisted tickets */
    @Get()
    findAll(): Promise<Ticket[]> {
        return this.ticketsService.findAll();
    }

    /** GET /tickets/:id — single ticket */
    @Get(':id')
    findOne(@Param('id') id: string): Promise<Ticket> {
        return this.ticketsService.findOne(id);
    }

    /** POST /tickets/scrape — trigger an on-demand scrape and persist results */
    @Post('scrape')
    @HttpCode(HttpStatus.OK)
    async triggerScrape() {
        const result = await this.scraperService.scrape();

        if (!result.success) {
            return { success: false, error: result.error, scrapedAt: result.scrapedAt };
        }

        const upserted = await this.ticketsService.upsertMany(result.tickets);
        return {
            success: true,
            scrapedAt: result.scrapedAt,
            ticketsFound: result.tickets.length,
            ticketsUpserted: upserted,
        };
    }
}
