import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { SyncScheduler } from './sync.scheduler';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket]),
        ScraperModule,
    ],
    controllers: [TicketsController],
    providers: [TicketsService, SyncScheduler],
    exports: [TicketsService],
})
export class TicketsModule {}
