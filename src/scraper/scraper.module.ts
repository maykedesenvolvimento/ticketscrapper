import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScraperScheduler } from './scraper.scheduler';

@Module({
    providers: [ScraperService, ScraperScheduler],
    exports: [ScraperService],
})
export class ScraperModule { }
