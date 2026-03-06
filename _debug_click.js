// Debug: trace ALL XHR responses after clicking button.btBuscar in the GSS tab
const { chromium } = require('playwright');
require('dotenv').config();

const { VIRTUALIF_LOGIN_URL, VIRTUALIF_TICKETS_URL, VIRTUALIF_USERNAME, VIRTUALIF_PASSWORD } = process.env;

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // LOGIN
    await page.goto(VIRTUALIF_LOGIN_URL, { waitUntil: 'networkidle' });
    await page.fill('#usuario', VIRTUALIF_USERNAME);
    await page.fill('#senha', VIRTUALIF_PASSWORD);
    await page.click('#btnEntrar');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in');

    // OPEN GSS TAB
    const [gssPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('a[href*="modulo=GSS"]'),
    ]);
    await gssPage.waitForLoadState('networkidle');
    console.log('✅ GSS tab:', gssPage.url());

    // ATTACH RESPONSE LISTENER before navigating
    const captured = [];
    gssPage.on('response', (res) => {
        const url = res.url();
        if (!url.startsWith('data:') && !url.includes('google') && !url.includes('.png') && !url.includes('.css') && !url.includes('.js') && !url.includes('.woff')) {
            captured.push({ url, status: res.status(), at: Date.now() });
        }
    });
    const startTime = Date.now();

    // NAVIGATE to ?menu=2278 and wait for networkidle to let auto-fires complete
    console.log('Navigating to:', VIRTUALIF_TICKETS_URL);
    await gssPage.goto(VIRTUALIF_TICKETS_URL, { waitUntil: 'networkidle' }).catch(() => {});
    console.log('✅ Navigation complete. URL:', gssPage.url());

    // Check if target was auto-fired during navigation
    const autoFired = captured.find(r => r.url.includes('consultarGssSolicitacaoGerenciamento2'));
    if (autoFired) {
        console.log('\n✅ Target endpoint auto-fired during navigation!');
        console.log('  URL:', autoFired.url);
        console.log('  At:', autoFired.at - startTime, 'ms after start');
    } else {
        console.log('\n  Target was NOT auto-fired during navigation. Responses so far:');
        for (const r of captured) console.log('  ', r.status, r.url.slice(0, 120));
    }

    captured.length = 0; // clear for next phase

    // Wait for button and note page state
    await gssPage.waitForSelector('button.btBuscar', { timeout: 20_000 });
    console.log('\n✅ button.btBuscar found');

    // First click - may load filter form
    console.log('--- CLICK 1 ---');
    await gssPage.evaluate(() => document.querySelector('button.btBuscar').click());
    await gssPage.waitForTimeout(5000);

    const after1 = [...captured];
    captured.length = 0;
    console.log('Responses after click 1:');
    for (const r of after1) console.log(' ', r.status, r.url.slice(0, 120));

    const hit1 = after1.find(r => r.url.includes('consultarGssSolicitacaoGerenciamento2'));
    if (hit1) {
        console.log('\n✅ Target fired on CLICK 1!');
    } else {
        // Second click
        console.log('\n--- CLICK 2 ---');
        await gssPage.evaluate(() => document.querySelector('button.btBuscar').click());
        await gssPage.waitForTimeout(5000);

        const after2 = [...captured];
        console.log('Responses after click 2:');
        for (const r of after2) console.log(' ', r.status, r.url.slice(0, 120));

        const hit2 = after2.find(r => r.url.includes('consultarGssSolicitacaoGerenciamento2'));
        if (hit2) {
            console.log('\n✅ Target fired on CLICK 2!');
        } else {
            console.log('\n❌ Target NOT fired on click 1 or 2.');
        }
    }

    await browser.close();
})();

