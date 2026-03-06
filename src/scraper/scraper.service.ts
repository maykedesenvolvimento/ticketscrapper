import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page } from 'playwright';

export interface RawTicket {
    id: string;
    openedAt: string;
    area: string;
    service: string;
    team: string;
    description: string;
    requester: string;
    unit: string;
    status: string;
    assignee: string;
    attendedAt: string;
    priority: string;
    waitTime: string;
}

export interface ScrapeResult {
    success: boolean;
    tickets: RawTicket[];
    scrapedAt: Date;
    error?: string;
}

const TICKETS_API_PATH = 'consultarGssSolicitacaoGerenciamento2.php';

interface VirtualIfApiResponse {
    status: string;
    obj: {
        propriedades: {
            paginaAtual: number;
            qtdRegistrosPorPagina: string;
            qtdRegistrosTotal: number;
            qtdPaginasTotal: number;
        };
        registros: string;
    };
}

@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);

    constructor(private readonly configService: ConfigService) { }

    async scrape(): Promise<ScrapeResult> {
        const scrapedAt = new Date();
        let browser: Browser | null = null;

        try {
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext();
            const page = await context.newPage();

            await this.login(page);
            const gssPage = await this.openGssModule(page);
            const tickets = await this.fetchTickets(gssPage);

            this.logger.log(`Scrape completed — ${tickets.length} ticket(s) found`);
            return { success: true, tickets, scrapedAt };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Scrape failed: ${message}`);
            return { success: false, tickets: [], scrapedAt, error: message };
        } finally {
            if (browser) await browser.close();
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private async login(page: Page): Promise<void> {
        const loginUrl = this.configService.get<string>('virtualif.loginUrl');
        const username = this.configService.get<string>('virtualif.username');
        const password = this.configService.get<string>('virtualif.password');

        if (!loginUrl || !username || !password) {
            throw new Error('Missing VirtualIF credentials in environment variables.');
        }

        this.logger.debug(`Navigating to login page: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle' });
        await page.fill('#usuario', username);
        await page.fill('#senha', password);
        await page.click('#btnEntrar');
        await page.waitForLoadState('networkidle');
        this.logger.debug('Login successful');
    }

    /**
     * Clicks the GSS module icon on the dashboard, which opens in a new tab.
     * Returns the new Page for the GSS module.
     */
    private async openGssModule(page: Page): Promise<Page> {
        this.logger.debug('Opening GSS module (new tab)');

        const [gssPage] = await Promise.all([
            page.context().waitForEvent('page'),
            page.click('a[href*="modulo=GSS"]'),
        ]);

        await gssPage.waitForLoadState('networkidle');
        this.logger.debug(`GSS module opened: ${gssPage.url()}`);
        return gssPage;
    }

    /**
     * In the GSS module:
     *  1. Navigate directly to the Gerenciamento view via ticketsUrl (ERR_ABORTED is normal for SPAs)
     *  2. Wait for the SPA to fully render and attach onClick handlers
     *  3. Click "Pesquisar" to trigger the tickets API call
     *  4. Capture and parse all pages of results
     */
    private async fetchTickets(page: Page): Promise<RawTicket[]> {
        const ticketsUrl = this.configService.get<string>('virtualif.ticketsUrl');
        if (!ticketsUrl) throw new Error('VIRTUALIF_TICKETS_URL is not configured');

        // Step 1 — Navigate to the Gerenciamento view
        // SPA hash-routing frequently aborts the navigation prematurely — that's fine.
        this.logger.debug(`Navigating to tickets URL: ${ticketsUrl}`);
        try {
            await page.goto(ticketsUrl, { waitUntil: 'load', timeout: 15_000 });
        } catch {
            this.logger.debug('goto aborted (normal for SPA) — continuing');
        }

        // Step 2 — Give the SPA JS time to fully render the form and wire up handlers
        await page.waitForTimeout(3_000);
        await page.waitForSelector('button.btBuscar', { timeout: 20_000 });
        this.logger.debug('Gerenciamento form ready, button.btBuscar visible');

        // Step 3 — Register listener THEN fire the click
        const responsePromise = page.waitForResponse(
            (res) => res.url().includes(TICKETS_API_PATH),
            { timeout: 30_000 },
        );

        this.logger.debug('Clicking Pesquisar (button.btBuscar)');
        await page.evaluate(() => {
            const btn = document.querySelector('button.btBuscar') as HTMLElement | null;
            if (!btn) throw new Error('button.btBuscar not found');
            btn.click();
        });

        const response = await responsePromise;
        const json = await response.json() as VirtualIfApiResponse;

        if (json.status !== 'ok' || !json.obj?.registros) {
            throw new Error(`Unexpected API response: ${JSON.stringify(json).slice(0, 200)}`);
        }

        this.logger.debug(
            `API returned ${json.obj.propriedades.qtdRegistrosTotal} ticket(s) across ${json.obj.propriedades.qtdPaginasTotal} page(s)`,
        );

        const tickets = await this.parseTicketsHtml(page, json.obj.registros);

        // Fetch remaining pages via direct API calls (reuses same session cookies)
        const { qtdPaginasTotal } = json.obj.propriedades;
        const firstPageUrl = response.url();

        if (qtdPaginasTotal > 1) {
            for (let pagina = 2; pagina <= qtdPaginasTotal; pagina++) {
                this.logger.debug(`Fetching page ${pagina}/${qtdPaginasTotal}`);
                const pageJson = await this.fetchPageDirect(page, firstPageUrl, pagina);
                const pageTickets = await this.parseTicketsHtml(page, pageJson.obj.registros);
                tickets.push(...pageTickets);
            }
        }

        return tickets;
    }

    /**
     * Fetches an additional page of tickets by replaying the API URL with a different
     * paginaAtual value, reusing the browser session (cookies) via page.evaluate→fetch.
     */
    private async fetchPageDirect(
        page: Page,
        firstPageUrl: string,
        pagina: number,
    ): Promise<VirtualIfApiResponse> {
        const url = new URL(firstPageUrl);
        url.searchParams.set('paginaAtual', String(pagina));
        const targetUrl = url.toString();

        const json = await page.evaluate(async (href: string) => {
            const res = await fetch(href, { credentials: 'include' });
            return res.json();
        }, targetUrl) as VirtualIfApiResponse;

        if (json.status !== 'ok' || !json.obj?.registros) {
            throw new Error(`Unexpected API response on page ${pagina}: ${JSON.stringify(json).slice(0, 200)}`);
        }
        return json;
    }

    /**
     * Injects the HTML fragment into a hidden div in the current page,
     * then uses page.evaluate to extract structured rows from the table.
     */
    private async parseTicketsHtml(page: Page, html: string): Promise<RawTicket[]> {
        return page.evaluate((registrosHtml: string): RawTicket[] => {
            const container = document.createElement('div');
            container.style.display = 'none';
            container.innerHTML = registrosHtml;
            document.body.appendChild(container);

            const rows = Array.from(container.querySelectorAll('tbody tr'));

            const tickets: RawTicket[] = rows.map((row) => {
                const cells = Array.from(row.querySelectorAll('td'));
                const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

                // Ticket ID is also stored in the button's data attribute — fallback to cell text
                const btn = row.querySelector('button[data-solicitacao_id]');
                const id = btn?.getAttribute('data-solicitacao_id') ?? text(cells[0]);

                // cell[2] has title attr = full description
                const description = cells[2]?.getAttribute('title') ?? '';
                const areaLines = text(cells[2]).split(/\s{2,}/);

                // Status is inside span.label
                const statusEl = cells[4]?.querySelector('span.label');

                return {
                    id,
                    openedAt: text(cells[1]),
                    area: areaLines[0] ?? '',
                    service: areaLines[1] ?? '',
                    team: areaLines[2] ?? '',
                    description,
                    requester: text(cells[3]?.querySelector('[style*="font-weight: bolder"]') ?? cells[3]),
                    unit: text(cells[3]?.querySelectorAll('div')[1] ?? null),
                    status: text(statusEl ?? cells[4]),
                    assignee: text(cells[5]),
                    attendedAt: text(cells[6]),
                    priority: text(cells[7]).split(/\s+/)[0] ?? '',
                    waitTime: text(cells[7]).replace(/^\S+\s*/, '').trim(),
                };
            });

            document.body.removeChild(container);
            return tickets;
        }, html);
    }
}
