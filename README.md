# BondStats Embed SDK v1.1

Repository: `bondstats-embed-sdk`

BondStats Embedded Intelligence is a zero-dependency browser SDK for embedding live fixed-income components and accessing a small JavaScript analytics API.

## Production script

```html
<script src="https://botapi33.github.io/bondstats-embed-sdk/embed.js" defer></script>
```

## Components

- `<bondstats-system-pressure>` — System Pressure Index
- `<bondstats-sovereign-spread>` — 10Y sovereign spread and daily change
- `<bondstats-financial-clock>` — IANA financial-center clocks with automatic DST
- `<bondstats-curve-signal>` — curve classification when both live tenors exist

## Default destinations

- System Pressure → `https://botapi33.github.io/bondstats-system-pressure-index/`
- Sovereign Spread → `https://botapi33.github.io/bondstats-curve-spread-scanner/`
- Financial Clock → `https://botapi33.github.io/bondstats-global-financial-clock/`
- Curve Signal → `https://botapi33.github.io/bondstats-curve-spread-scanner/`

Every component supports a `link="..."` override.

## JavaScript API

```js
const state = await BondStats.getSystemPressure();
const spread = await BondStats.getSpread('Italy', 'Germany');
const market = await BondStats.getMarket('United States', '10Y');
const curve = await BondStats.getCurveSignal('United States', '2Y', '10Y');
const health = await BondStats.diagnostics();
```

## Data rules

Default feed: `https://botapi33.github.io/bondstats-global-yields/global_yields.json`

Live analytics require daily, non-fallback observations with evidence of freshness of no more than seven days. When both `value` and `previousValue` exist, daily basis-point changes are calculated from those levels to remove ambiguity in upstream change units. Missing curve tenors are never synthesized.

A custom feed can be supplied for testing or future hosting:

```html
<script
  src="https://botapi33.github.io/bondstats-embed-sdk/embed.js"
  data-bondstats-data-url="https://example.com/feed.json"
  defer></script>
```

## Health check

Open `health.html` after deployment or run:

```js
console.table(await BondStats.diagnostics());
```

The diagnostic checks feed access, eligible market coverage, component registration and IANA time-zone support.
