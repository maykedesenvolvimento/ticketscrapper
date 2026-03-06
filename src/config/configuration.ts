export default () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    virtualif: {
        loginUrl: process.env.VIRTUALIF_LOGIN_URL,
        ticketsUrl: process.env.VIRTUALIF_TICKETS_URL,
        username: process.env.VIRTUALIF_USERNAME,
        password: process.env.VIRTUALIF_PASSWORD,
    },
    scraper: {
        cron: process.env.SCRAPER_CRON ?? '0 */6 * * *',
    },
});
