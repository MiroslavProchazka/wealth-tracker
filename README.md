# Wealth Tracker

Personal finance and net worth tracker built as a local-first Next.js app.

## Product Scope

The app tracks:

- crypto holdings
- stock and ETF holdings
- real estate
- savings accounts
- receivables
- net worth snapshots and charts

## Architecture

This repository is now aligned around an **Evolu-only app data model**.

- **Evolu** stores the application data used by the UI.
- **Next.js API routes** are used for external market data and search.
- **Prisma has been removed** from the active architecture.

Architecture notes: [docs/ARCHITECTURE.md](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/docs/ARCHITECTURE.md)

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Evolu
- better-sqlite3
- CoinGecko
- Yahoo Finance
- Recharts
- Vitest
- Playwright

## Main App Areas

- [app/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/page.tsx): dashboard
- [app/crypto/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/crypto/page.tsx): crypto holdings
- [app/stocks/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/stocks/page.tsx): stocks and ETFs
- [app/property/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/property/page.tsx): real estate
- [app/savings/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/savings/page.tsx): savings accounts
- [app/receivables/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/receivables/page.tsx): receivables
- [app/history/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/history/page.tsx): snapshot history and charts
- [app/settings/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/settings/page.tsx): seed phrase and relay settings

## Data Model

The application data model is defined in [lib/evolu.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/evolu.ts).

The main UI pages read and write through:

- `useEvolu()`
- `evolu.createQuery(...)`
- `useQuery(...)`
- `evolu.insert(...)`
- `evolu.update(...)`

This means:

- holdings are local-first
- snapshots are local-first
- sync is relay-based
- external APIs are used only for market data, not primary CRUD

## API Routes

The retained API surface is integration-only:

- [app/api/crypto/prices/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/crypto/prices/route.ts)
- [app/api/crypto/history/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/crypto/history/route.ts)
- [app/api/crypto/search/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/crypto/search/route.ts)
- [app/api/stocks/prices/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/stocks/prices/route.ts)
- [app/api/stocks/history/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/stocks/history/route.ts)
- [app/api/stocks/search/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/stocks/search/route.ts)

## Local Setup

Install dependencies:

```bash
npm ci
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

## Environment

Depending on which features you use, the code may expect:

- `COINGECKO_API_KEY`
- `ALPHA_VANTAGE_API_KEY`

Notes:

- the active stock API routes use Yahoo Finance
- Alpha Vantage currently appears to be a secondary helper path in [lib/stocks.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/stocks.ts)

## Testing

Configured test layers:

- unit tests in [tests/unit](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/tests/unit)
- component tests in [tests/components](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/tests/components)
- e2e tests in [tests/e2e](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/tests/e2e)

CI workflow: [ci.yml](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/.github/workflows/ci.yml)

## Improvement Backlog

Tracked here: [docs/CLEANUP_MAP.md](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/docs/CLEANUP_MAP.md)

## Process Docs

- [CONTRIBUTING.md](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/CONTRIBUTING.md)
- [CHANGELOG.md](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/CHANGELOG.md)
