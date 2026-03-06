import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './ticket.entity';
import { type RawTicket } from '../scraper/scraper.service';

@Injectable()
export class TicketsService {
    private readonly logger = new Logger(TicketsService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly repo: Repository<Ticket>,
    ) { }

    /**
     * Upsert a batch of raw tickets. Returns the number of new/updated records.
     */
    async upsertMany(rawTickets: RawTicket[]): Promise<number> {
        if (rawTickets.length === 0) return 0;

        await this.repo.upsert(rawTickets, ['id']);
        this.logger.log(`Upserted ${rawTickets.length} ticket(s)`);
        return rawTickets.length;
    }

    /** Return all tickets, newest first. */
    findAll(): Promise<Ticket[]> {
        return this.repo.find({ order: { updatedAt: 'DESC' } });
    }

    /** Return a single ticket by its VirtualIF ID. */
    async findOne(id: string): Promise<Ticket> {
        const ticket = await this.repo.findOneBy({ id });
        if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
        return ticket;
    }
}
