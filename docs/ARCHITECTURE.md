# Architecture

## Summary

Wealth Tracker is a **local-first** application.

- Application data lives in **Evolu**
- The UI reads and writes directly against Evolu
- Server routes are used for **market data and symbol lookup**
- There is no longer a server-side Prisma persistence layer in the active architecture

This matches the Evolu usage pattern you described from the `fakturing` repository: local application data first, external APIs second.

## Core Data Flow

### 1. Local data

Evolu setup lives in [lib/evolu.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/evolu.ts).

It defines the client-side tables used by the app:

- `cryptoHolding`
- `stockHolding`
- `property`
- `receivable`
- `savingsAccount`
- `netWorthSnapshot`

Pages query and mutate this data directly through Evolu:

- [app/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/page.tsx)
- [app/crypto/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/crypto/page.tsx)
- [app/stocks/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/stocks/page.tsx)
- [app/property/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/property/page.tsx)
- [app/savings/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/savings/page.tsx)
- [app/receivables/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/receivables/page.tsx)
- [app/history/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/history/page.tsx)
- [app/settings/page.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/settings/page.tsx)

The practical behavior is:

- holdings are created locally
- edits are stored locally
- records are soft-deleted locally
- snapshots are stored locally
- sync happens through the Evolu relay

## Why Evolu is the source of truth

The current UI depends on Evolu for:

- data entry
- local querying
- account restore from mnemonic
- relay configuration
- sync status expectations in the UI

That makes Evolu the actual app database from the product point of view, not just a cache.

## Integration Layer

The remaining server routes are used only to enrich local data with external information.

### Crypto routes

- [app/api/crypto/prices/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/crypto/prices/route.ts)
- [app/api/crypto/history/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/crypto/history/route.ts)
- [app/api/crypto/search/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/crypto/search/route.ts)

Backed by [lib/coingecko.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/coingecko.ts).

### Stock routes

- [app/api/stocks/prices/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/stocks/prices/route.ts)
- [app/api/stocks/history/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/stocks/history/route.ts)
- [app/api/stocks/search/route.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/api/stocks/search/route.ts)

The active stock integration uses Yahoo Finance. [lib/stocks.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/stocks.ts) still exists as a secondary Alpha Vantage helper path and should be treated as optional or legacy unless kept intentionally.

## App Shell

- Root layout: [app/layout.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/app/layout.tsx)
- Sidebar: [components/Sidebar.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/components/Sidebar.tsx)
- Evolu provider: [components/EvoluClientProvider.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/components/EvoluClientProvider.tsx)
- No-SSR wrapper for Evolu bootstrap: [components/EvoluNoSSR.tsx](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/components/EvoluNoSSR.tsx)

## Build and Tooling

Main config files:

- [next.config.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/next.config.ts)
- [vitest.config.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/vitest.config.ts)
- [playwright.config.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/playwright.config.ts)
- [eslint.config.mjs](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/eslint.config.mjs)

Main commands:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`

## Remaining Risks

The architecture is clearer now, but a few cleanup areas remain:

- stale e2e tests and mocks
- mixed Czech/English product copy
- unclear status of optional Alpha Vantage helper code
- root-level `dev.db` still exists as a repository artifact even though Prisma is gone

## Schema Evolution

Evolu schema changes must follow an explicit migration policy. See
[docs/EVOLU_MIGRATIONS.md](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/docs/EVOLU_MIGRATIONS.md).
