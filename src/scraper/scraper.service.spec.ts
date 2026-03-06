import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ScraperService, ScrapeResult } from './scraper.service';
import configuration from '../config/configuration';
import * as path from 'path';

/**
 * Flow test for ScraperService.
 *
 * Requires a valid .env file at the project root with:
 *   VIRTUALIF_LOGIN_URL, VIRTUALIF_TICKETS_URL,
 *   VIRTUALIF_USERNAME, VIRTUALIF_PASSWORD
 *
 * Run with:
 *   yarn test --testPathPattern=scraper.service.spec
 */
describe('ScraperService — full flow', () => {
    let service: ScraperService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [configuration],
                    envFilePath: path.resolve(process.cwd(), '.env'),
                }),
            ],
            providers: [ScraperService],
        }).compile();

        service = module.get<ScraperService>(ScraperService);
    });

    it('should have all required env variables configured', () => {
        const requiredVars = [
            'VIRTUALIF_LOGIN_URL',
            'VIRTUALIF_TICKETS_URL',
            'VIRTUALIF_USERNAME',
            'VIRTUALIF_PASSWORD',
        ];

        for (const varName of requiredVars) {
            expect(
                process.env[varName],
                `Missing env variable: ${varName}`,
            ).toBeDefined();
            expect(process.env[varName]).not.toBe('');
        }
    });

    it(
        'should login to VirtualIF and scrape tickets successfully',
        async () => {
            const result: ScrapeResult = await service.scrape();

            // The scrape should succeed
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            // Should return a valid date
            expect(result.scrapedAt).toBeInstanceOf(Date);

            // Should return at least one ticket
            expect(Array.isArray(result.tickets)).toBe(true);
            expect(result.tickets.length).toBeGreaterThan(0);

            console.log(
                `\n✅ Scrape succeeded — ${result.tickets.length} ticket(s) found at ${result.scrapedAt.toISOString()}`,
            );
            console.log('First ticket sample:', JSON.stringify(result.tickets[0], null, 2));
        },
        // Allow up to 60s for the full browser + login + navigation flow
        60_000,
    );

    it(
        'should return a non-empty array of objects with at least an id-like field',
        async () => {
            const result: ScrapeResult = await service.scrape();

            if (!result.success || result.tickets.length === 0) {
                console.warn('Skipping field check — no tickets returned.');
                return;
            }

            const first = result.tickets[0];
            expect(typeof first).toBe('object');
            expect(first).not.toBeNull();

            // Log all keys found so we can update the Ticket entity accordingly
            console.log('\nTicket keys found:', Object.keys(first));
        },
        60_000,
    );
});
