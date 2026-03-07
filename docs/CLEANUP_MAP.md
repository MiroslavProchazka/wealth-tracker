# Cleanup Map

This file tracks the remaining cleanup work after removing Prisma and standardizing on Evolu.

## Highest Priority

### 1. Repair tests after the architecture cleanup

Current risk:

- some e2e tests still encode assumptions from older UI states
- some mocks appear older than the current API response shapes
- snapshot-related tests may still assume server persistence

Recommendation:

- audit e2e tests page by page
- keep only active user journeys
- rewrite stale tests to match the Evolu-first behavior

### 2. Verify the project on a supported Node runtime

Current blocker:

- this machine is on Node `20.18.0`
- current dependency set requires at least Node `20.19.0` or Node 22 for a clean install

Recommendation:

- run verification on Node `20.19+` or `22.12+`
- after that, regenerate the lockfile cleanly

### 3. Regenerate `package-lock.json`

Current state:

- Prisma has been removed from `package.json`
- the lockfile still needs a clean regenerate on a supported Node runtime

Recommendation:

- after switching Node, run a clean install and commit the regenerated lockfile

## Medium Priority

### 4. Clarify provider strategy

Current state:

- active stock routes use Yahoo Finance
- [lib/stocks.ts](/Users/miroslavprochazka/Documents/DEVELOPMENT/wealth-tracker/lib/stocks.ts) still contains Alpha Vantage-based helpers

Recommendation:

- either document Alpha Vantage as optional legacy support
- or remove it if it is no longer intended

### 5. Clean up navigation/product consistency

Current state:

- receivables page exists
- sidebar navigation does not expose it
- older tests mention previous navigation labels

Recommendation:

- decide whether receivables should be a top-level section
- then align sidebar, tests, and copy

### 6. Standardize product language

Current state:

- the UI mixes English and Czech
- tests mirror that inconsistency

Recommendation:

- choose one product language direction
- then apply it systematically in UI and tests

## Lower Priority

### 7. Remove leftover repository artifacts

Candidates:

- root-level `dev.db`
- comments referring to removed server persistence
- any dead references to Prisma in tests or docs

## Suggested Order

1. Switch to supported Node
2. Run `npm ci`
3. Regenerate and commit `package-lock.json`
4. Run lint, typecheck, unit tests, and e2e tests
5. Fix the failing tests and stale mocks
6. Resume product improvements
