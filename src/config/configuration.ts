/** Decodes a base64-encoded string; falls back to plain text for local dev convenience. */
function decodePassword(raw = ''): string {
    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        // If re-encoding matches original, it was valid base64
        if (Buffer.from(decoded).toString('base64') === raw) return decoded;
    } catch { /* ignore */ }
    return raw;
}

export default () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    virtualif: {
        loginUrl: process.env.VIRTUALIF_LOGIN_URL,
        ticketsUrl: process.env.VIRTUALIF_TICKETS_URL,
        username: process.env.VIRTUALIF_USERNAME,
        password: decodePassword(process.env.VIRTUALIF_PASSWORD),
    },
    scraper: {
        cron: process.env.SCRAPER_CRON ?? '0 */6 * * *',
    },
});
