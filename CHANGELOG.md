# Changelog

All notable changes to **Wealth Tracker** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/) — `vMAJOR.MINOR.PATCH`.

---

## [Unreleased]

### Added
- Stocks section: live prices, P&L, charts, alerts, sector breakdown (Yahoo Finance, no API key needed)
- Stock ticker autocomplete with exchange info
- Support for US, EU and CZ stocks/ETFs (CEZ.PR, KOMB.PR, VUSA.L, etc.)
- Portfolio allocation bar in Stocks view
- Detail modal per stock (open/high/low, market cap, P/E, dividend yield, 52W range)
- Extended Evolu schema: `buyPrice`, `exchange`, `sector` fields for stock holdings
- Onboarding start choice: `Test Account` (demo import) vs `Start Empty`
- Demo account import seeds all portfolio sections and enables notes/tag/allocation modules
- Demo market mode with hardcoded crypto/stock prices and fiat rates (works without API keys)

---

## [0.1.0] — 2026-02-27

### Added
- Initial release: full wealth tracker with crypto, stocks, savings, bank accounts, property, receivables, goals
- Crypto section: live CoinGecko prices, P&L, allocation chart, historical charts, price alerts
- Local crypto icons (483 coins)
- End-to-end encrypted sync via Evolu + WebSocket relay
- Net worth dashboard with summary cards
- History page with net worth snapshots
- Settings: seed phrase backup, relay configuration
- Comprehensive test suite (unit, component, E2E)

[Unreleased]: https://github.com/MiroslavProchazka/wealth-tracker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MiroslavProchazka/wealth-tracker/releases/tag/v0.1.0
