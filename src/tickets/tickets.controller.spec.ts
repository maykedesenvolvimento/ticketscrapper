import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ScraperService, ScrapeResult } from '../scraper/scraper.service';
import { Ticket } from './ticket.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Ticket-like object for seeding / assertions. */
function makeTicket(id: string, overrides: Partial<Ticket> = {}): Ticket {
    return Object.assign(new Ticket(), {
        id,
        openedAt: '01/01/2026 09:00',
        area: 'TI',
        service: 'Suporte',
        team: 'CTIC',
        description: `Ticket ${id}`,
        requester: 'Test User',
        unit: 'Campus Test',
        status: 'NOVA',
        assignee: '',
        attendedAt: '',
        priority: '0',
        waitTime: '1h',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// In-memory repo factory (no real DB required to run these tests quickly)
// ---------------------------------------------------------------------------

function makeInMemoryRepo(seed: Ticket[] = []) {
    const store = new Map<string, Ticket>(seed.map((t) => [t.id, t]));

    return {
        find: jest.fn(({ order } = {}) => {
            const items = Array.from(store.values());
            if (order?.updatedAt === 'DESC') {
                items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            }
            return Promise.resolve(items);
        }),
        findOneBy: jest.fn(({ id }: { id: string }) =>
            Promise.resolve(store.get(id) ?? null),
        ),
        upsert: jest.fn((data: Partial<Ticket>[], _keys: string[]) => {
            for (const item of data) {
                store.set(item.id!, Object.assign(makeTicket(item.id!), item));
            }
            return Promise.resolve({ generatedMaps: [] });
        }),
        _store: store,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TicketsController — resilience to scraper failures', () => {
    let controller: TicketsController;
    let ticketsService: TicketsService;
    let scraperService: jest.Mocked<ScraperService>;
    let repo: ReturnType<typeof makeInMemoryRepo>;

    const EXISTING_TICKETS = [makeTicket('100'), makeTicket('101'), makeTicket('102')];

    beforeEach(async () => {
        repo = makeInMemoryRepo(EXISTING_TICKETS);

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TicketsController],
            providers: [
                TicketsService,
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: repo,
                },
                {
                    provide: ScraperService,
                    useValue: {
                        scrape: jest.fn(),
                    },
                },
                // DataSource is only needed if TypeORM tries to connect — provide a stub
                {
                    provide: DataSource,
                    useValue: {},
                },
            ],
        }).compile();

        controller = module.get(TicketsController);
        ticketsService = module.get(TicketsService);
        scraperService = module.get(ScraperService) as jest.Mocked<ScraperService>;
    });

    // -------------------------------------------------------------------------
    // GET /tickets
    // -------------------------------------------------------------------------

    describe('GET /tickets', () => {
        it('returns all persisted tickets regardless of scraper state', async () => {
            const tickets = await controller.findAll();

            expect(tickets).toHaveLength(3);
            expect(tickets.map((t) => t.id)).toEqual(
                expect.arrayContaining(['100', '101', '102']),
            );
        });

        it('returns an empty array (not an error) when the DB has no tickets yet', async () => {
            const emptyRepo = makeInMemoryRepo([]);
            const m = await Test.createTestingModule({
                controllers: [TicketsController],
                providers: [
                    TicketsService,
                    { provide: getRepositoryToken(Ticket), useValue: emptyRepo },
                    { provide: ScraperService, useValue: { scrape: jest.fn() } },
                    { provide: DataSource, useValue: {} },
                ],
            }).compile();

            const tickets = await m.get(TicketsController).findAll();
            expect(tickets).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // GET /tickets/:id
    // -------------------------------------------------------------------------

    describe('GET /tickets/:id', () => {
        it('returns the requested ticket when it exists', async () => {
            const ticket = await controller.findOne('101');
            expect(ticket.id).toBe('101');
        });

        it('throws NotFoundException for an unknown id', async () => {
            await expect(controller.findOne('9999')).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // POST /tickets/scrape — happy path
    // -------------------------------------------------------------------------

    describe('POST /tickets/scrape — success', () => {
        it('scrapes and upserts tickets, returning a success summary', async () => {
            const newTickets = [makeTicket('200'), makeTicket('201')];
            const fakeResult: ScrapeResult = {
                success: true,
                tickets: newTickets,
                scrapedAt: new Date(),
            };
            scraperService.scrape.mockResolvedValue(fakeResult);

            const response = await controller.triggerScrape();

            expect(response.success).toBe(true);
            expect(response.ticketsFound).toBe(2);
            expect(response.ticketsUpserted).toBe(2);

            // Newly scraped tickets must be in the store
            expect(repo._store.has('200')).toBe(true);
            expect(repo._store.has('201')).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // POST /tickets/scrape — scraper fails
    // -------------------------------------------------------------------------

    describe('POST /tickets/scrape — scraper failure', () => {
        it('returns success:false when scraper returns an error result', async () => {
            const failResult: ScrapeResult = {
                success: false,
                tickets: [],
                scrapedAt: new Date(),
                error: 'Login timeout',
            };
            scraperService.scrape.mockResolvedValue(failResult);

            const response = await controller.triggerScrape();

            expect(response.success).toBe(false);
            expect((response as any).error).toBe('Login timeout');
        });

        it('returns success:false when scraper throws unexpectedly', async () => {
            scraperService.scrape.mockRejectedValue(new Error('Chromium crashed'));

            // The controller itself does not catch thrown errors — ScraperService.scrape()
            // already swallows all exceptions internally and returns {success:false}.
            // However, to verify resilience at the HTTP layer we test through the service.
            // If scrape() somehow throws, NestJS returns a 500 — verify the EXISTING tickets are unaffected.
            await expect(controller.triggerScrape()).rejects.toThrow('Chromium crashed');

            // Existing DB rows must be untouched
            const tickets = await controller.findAll();
            expect(tickets).toHaveLength(3);
        });

        it('does NOT touch existing tickets when scrape returns no results', async () => {
            const failResult: ScrapeResult = {
                success: false,
                tickets: [],
                scrapedAt: new Date(),
                error: 'Network error',
            };
            scraperService.scrape.mockResolvedValue(failResult);

            await controller.triggerScrape();

            // Pre-seeded tickets must still be there
            const tickets = await controller.findAll();
            expect(tickets).toHaveLength(3);
            expect(repo.upsert).not.toHaveBeenCalled();
        });

        it('keeps previously scraped tickets readable after a failed sync', async () => {
            // First scrape succeeds and adds ticket 300
            scraperService.scrape.mockResolvedValueOnce({
                success: true,
                tickets: [makeTicket('300')],
                scrapedAt: new Date(),
            });
            await controller.triggerScrape();
            expect(repo._store.has('300')).toBe(true);

            // Second scrape fails
            scraperService.scrape.mockResolvedValueOnce({
                success: false,
                tickets: [],
                scrapedAt: new Date(),
                error: 'VPN required',
            });
            await controller.triggerScrape();

            // Ticket 300 is still accessible
            const ticket = await controller.findOne('300');
            expect(ticket.id).toBe('300');

            // All original tickets are also intact
            const all = await controller.findAll();
            expect(all.map((t) => t.id)).toContain('100');
            expect(all.map((t) => t.id)).toContain('300');
        });
    });
});
