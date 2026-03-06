const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(process.env.VIRTUALIF_LOGIN_URL, { waitUntil: 'networkidle' });
    await page.fill('#usuario', process.env.VIRTUALIF_USERNAME);
    await page.fill('#senha', process.env.VIRTUALIF_PASSWORD);
    await page.click('#btnEntrar');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in');

    // Open GSS tab
    const [gssPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('a[href*="modulo=GSS"]'),
    ]);
    await gssPage.waitForLoadState('networkidle');
    console.log('✅ GSS tab opened:', gssPage.url());

    // Find anything mentioning "Gerenciamento" in the sidebar/menu
    const gerenciamentoLinks = await gssPage.evaluate(() => {
        return Array.from(document.querySelectorAll('a, li, span, div'))
            .filter(el => el.textContent.trim().toLowerCase().includes('gerenciamento') && el.children.length < 3)
            .map(el => ({
                tag: el.tagName,
                text: el.textContent.trim().slice(0, 80),
                id: el.id,
                class: el.className.slice(0, 80),
                href: el.getAttribute('href') || '',
                onclick: el.getAttribute('onclick') || '',
            }))
            .slice(0, 15);
    });
    console.log('\nGerenciamento elements:', JSON.stringify(gerenciamentoLinks, null, 2));

    // Try clicking first one that has an href or is an <a>
    const clickTarget = gerenciamentoLinks.find(el => el.href || el.tag === 'A');
    if (!clickTarget) {
        console.log('\nNo direct link found — checking all nav items');
        const navItems = await gssPage.evaluate(() =>
            Array.from(document.querySelectorAll('#menu a, .menu a, nav a, .sidebar a, .nav a'))
                .map(el => ({ text: el.textContent.trim().slice(0,60), href: el.href }))
                .filter(el => el.text)
        );
        console.log('Nav items:', JSON.stringify(navItems, null, 2));
        await browser.close();
        return;
    }

    console.log(`\nClicking: ${JSON.stringify(clickTarget)}`);

    // Register response listener BEFORE click
    const responsePromise = gssPage.waitForResponse(
        r => r.url().includes('consultarGssSolicitacaoGerenciamento2'),
        { timeout: 30000 }
    ).catch(e => { console.log('No auto-response:', e.message); return null; });

    // Click the Gerenciamento link
    if (clickTarget.href) {
        await gssPage.click(`a[href="${clickTarget.href}"]`);
    } else {
        await gssPage.click(`${clickTarget.tag}:has-text("${clickTarget.text.slice(0,30)}")`);
    }
    await gssPage.waitForLoadState('networkidle').catch(() => {});
    await gssPage.waitForTimeout(2000);
    console.log('URL after Gerenciamento click:', gssPage.url());

    const autoResponse = await responsePromise;
    if (autoResponse) {
        const json = await autoResponse.json();
        console.log('\n✅ Auto-fired!', json.status, '| tickets:', json.obj?.propriedades?.qtdRegistrosTotal);
    } else {
        const hasBuscar = await gssPage.$('button.btBuscar');
        console.log('button.btBuscar present:', !!hasBuscar);
        if (hasBuscar) {
            const res2 = gssPage.waitForResponse(r => r.url().includes('consultarGssSolicitacaoGerenciamento2'), { timeout: 15000 });
            await gssPage.evaluate(() => document.querySelector('button.btBuscar').click());
            const r = await res2;
            const j = await r.json().catch(() => null);
            console.log('✅ Pesquisar response:', j?.status, '| tickets:', j?.obj?.propriedades?.qtdRegistrosTotal);
        }
    }

    await browser.close();
})();