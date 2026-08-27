# BondStats Embed SDK v1.2

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

## Public destinations

GitHub Pages is used only to deliver the SDK script and live data. By default, every visible widget CTA points to `https://www.bondstats.org/` so integrations always return users to BondStats rather than GitHub.

There is deliberately **no default Curve & Spread Scanner link** because that public BondStats page does not currently exist. Product-specific BondStats URLs can be supplied later without changing the SDK:

```html
<bondstats-financial-clock link="https://www.bondstats.org/"></bondstats-financial-clock>
```

or globally:

```html
<script>
window.BondStatsConfig = {
  links: {
    systemPressure: 'https://www.bondstats.org/',
    sovereignSpread: 'https://www.bondstats.org/',
    financialClock: 'https://www.bondstats.org/',
    curveSignal: 'https://www.bondstats.org/'
  }
};
</script>
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
