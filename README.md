# BondStats Embed SDK v1.3

Repository: `bondstats-embed-sdk`

BondStats Embedded Intelligence is a zero-dependency browser SDK for embedding fixed-income components and accessing a small JavaScript analytics API.

## Production script

```html
<script src="https://botapi33.github.io/bondstats-embed-sdk/embed.js" defer></script>
```

## Components

- `<bondstats-system-pressure>` — strict current-state System Pressure Index
- `<bondstats-sovereign-spread>` — 10Y sovereign spread using latest valid observations with explicit freshness labels
- `<bondstats-financial-clock>` — IANA financial-center clocks with automatic DST
- `<bondstats-curve-signal>` — curve slope from recent comparable tenors; dynamic steepening/flattening labels only when both tenor moves are fresh daily data

## Two data modes

BondStats v1.3 deliberately separates **current-state analytics** from **reference comparisons**.

### Current-state mode
Used by System Pressure and dynamic daily change signals. Records must be daily, non-fallback and no more than 7 days stale.

### Reference mode
Used by sovereign spread levels and curve levels. The SDK selects the latest non-fallback valid observation up to 120 days old and labels it `Fresh daily`, `Latest available`, or `Delayed`. Observation dates are shown separately for each market.

A daily spread-change signal is shown only when both markets are fresh daily observations within two calendar days of each other. Curve steepening/flattening labels follow the same rule. Missing values are never synthesized, and records older than 120 days are excluded from reference calculations.

## Public destinations

GitHub Pages is used only to deliver the SDK script and live data. By default, every visible widget CTA points to `https://www.bondstats.org/`. Product-specific BondStats URLs can be supplied through `window.BondStatsConfig.links` or a component's `link` attribute.

## Data feed

Default feed: `https://botapi33.github.io/bondstats-global-yields/global_yields.json`

A custom feed can be supplied for testing:

```html
<script
  src="https://botapi33.github.io/bondstats-embed-sdk/embed.js"
  data-bondstats-data-url="https://example.com/feed.json"
  defer></script>
```

## Health and self-test

Open `health.html` after deployment or run:

```js
console.table(await BondStats.diagnostics());
BondStats.selfTest();
```

The built-in self-test verifies mixed-frequency spreads, suppression of invalid daily change signals, curve classification, stale-reference exclusion and the System Pressure engine independently of the live feed.
