# TicketScrapper

A NestJS-based service that automatically scrapes tickets from the **VirtualIF** institutional portal using Playwright, persists the data, and exposes it through a REST API.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          TicketScrapper                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Scraper    │    │  Persistence │    │   REST API       │  │
│  │   Module     │───▶│   Module     │───▶│   Module         │  │
│  │ (Playwright) │    │  (Database)  │    │  (NestJS/JSON)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Scraping Flow (Playwright)

The scraper module uses **Playwright** in headless mode to automate the entire session with VirtualIF:

1. **Launch browser** — Playwright opens a Chromium instance (headless).
2. **Login** — Navigates to the VirtualIF login page and submits institutional credentials (loaded from environment variables).
3. **Navigate** — Redirects to the tickets management URL after successful authentication.
4. **Intercept responses** — Instead of parsing the DOM, Playwright intercepts the network responses (XHR/Fetch) from the tickets endpoint to capture the raw JSON payload directly.
5. **Extract tickets** — The intercepted response body is parsed and normalized into a `Ticket` entity.

```
Playwright
  │
  ├── page.goto(LOGIN_URL)
  ├── page.fill(credentials)
  ├── page.click(submitButton)
  ├── page.goto(TICKETS_URL)
  └── page.on('response', handler) ──▶ capture JSON payload
```

### 2. Persistence

Scraped tickets are stored in a local database (SQLite for development, configurable for production). The persistence layer uses **TypeORM** with a `Ticket` entity and handles:

- **Upsert logic** — prevents duplicates on repeated scrapes.
- **Timestamps** — tracks `createdAt` and `updatedAt` for each ticket.
- **Scrape log** — records each scrape run with status and ticket count.

### 3. REST API

NestJS exposes a REST API that serves the persisted tickets as JSON:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tickets` | Returns all tickets |
| `GET` | `/tickets/:id` | Returns a single ticket by ID |
| `POST` | `/tickets/scrape` | Triggers a manual scrape run |
| `GET` | `/tickets/scrape/status` | Returns the status of the last scrape |

---

## Module Structure

```
src/
├── app.module.ts
├── main.ts
│
├── scraper/
│   ├── scraper.module.ts
│   ├── scraper.service.ts       # Playwright automation logic
│   └── scraper.scheduler.ts    # Cron job for automatic scraping
│
├── tickets/
│   ├── tickets.module.ts
│   ├── tickets.controller.ts   # REST endpoints
│   ├── tickets.service.ts      # Business logic
│   ├── tickets.repository.ts   # DB access layer
│   └── entities/
│       └── ticket.entity.ts    # TypeORM entity
│
└── config/
    └── configuration.ts        # Environment config (credentials, URLs, DB)
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# VirtualIF credentials
VIRTUALIF_LOGIN_URL=https://virtualif.example.com/login
VIRTUALIF_TICKETS_URL=https://virtualif.example.com/tickets
VIRTUALIF_USERNAME=your_username
VIRTUALIF_PASSWORD=your_password

# Database
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/tickets.db

# Scraper
SCRAPER_CRON=0 */6 * * *   # runs every 6 hours by default

# App
PORT=3000
```

---

## Project Setup

```bash
yarn install
```

## Compile and Run

```bash
# development
yarn start

# watch mode
yarn start:dev

# production mode
yarn start:prod
```

## Run Tests

```bash
# unit tests
yarn test

# e2e tests
yarn test:e2e

# test coverage
yarn test:cov
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS |
| Scraping | Playwright (Chromium) |
| ORM | TypeORM |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Scheduling | `@nestjs/schedule` (cron) |
| Validation | `class-validator` / `class-transformer` |
| Config | `@nestjs/config` |

---

## License

MIT
