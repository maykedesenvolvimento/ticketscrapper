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

    /**
     * Mark previously-active tickets that are absent from the latest scrape as resolved.
     * VirtualIF only returns open tickets, so absence means the ticket was closed there.
     */
    async markAbsentAsResolved(presentIds: string[]): Promise<number> {
        if (presentIds.length === 0) return 0;

        const stale = await this.repo
            .createQueryBuilder('t')
            .where('t.id NOT IN (:...ids)', { ids: presentIds })
            .andWhere(
                "(UPPER(t.status) LIKE '%NOVA%' OR UPPER(t.status) LIKE '%ATENDIMENTO%' OR UPPER(t.status) LIKE '%ANDAMENTO%')",
            )
            .getMany();

        if (stale.length === 0) return 0;

        for (const t of stale) t.status = 'RESOLVIDA';
        await this.repo.save(stale);
        this.logger.log(`Marked ${stale.length} absent active ticket(s) as resolved`);
        return stale.length;
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
