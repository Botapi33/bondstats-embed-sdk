# BondStats Embed SDK

**BondStats Embedded Intelligence** — embeddable fixed-income components for websites, dashboards and research tools.

## Repo name
`bondstats-embed-sdk`

## v1 components
- `<bondstats-system-pressure>` — live BondStats System Pressure Index
- `<bondstats-sovereign-spread>` — 10Y sovereign spread and daily spread change
- `<bondstats-financial-clock>` — live IANA financial-center clocks
- `<bondstats-curve-signal>` — curve classification when the requested live tenors exist

## JavaScript API
```js
const pressure = await BondStats.getSystemPressure();
const spread = await BondStats.getSpread('Italy', 'Germany');
const market = await BondStats.getMarket('United States', '10Y');
const curve = await BondStats.getCurveSignal('United States', '2Y', '10Y');
```

## Quick start
```html
<script src="https://YOUR-DOMAIN/embed.js" defer></script>
<bondstats-system-pressure theme="dark"></bondstats-system-pressure>
```

The SDK is zero-dependency and uses Shadow DOM, so publisher CSS does not leak into the widgets. Data-backed components share a single cached request and auto-refresh every 15 minutes.

## Data
Default data source:
`https://botapi33.github.io/bondstats-global-yields/global_yields.json`

Live analytics prefer daily, non-fallback observations no more than seven days stale. Curve data is never synthesized when tenors are unavailable.

## GitHub Pages
Upload all files to the repository root and enable:
**Settings → Pages → Deploy from a branch → main → /(root)**

Then the public SDK URL will be:
`https://<username>.github.io/bondstats-embed-sdk/embed.js`

For long-term developer adoption, serve the SDK from a stable BondStats-controlled URL such as `https://www.bondstats.org/embed.js` or a dedicated developer subdomain/CDN endpoint.

## Integration policy
This repository is intended to demonstrate and distribute BondStats embeds. Keep BondStats attribution visible in published integrations. Underlying third-party/source data remains subject to its applicable source terms. No investment advice.
