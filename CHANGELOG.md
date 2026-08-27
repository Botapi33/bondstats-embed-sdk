# Changelog

## v1.3.0

- Split data handling into strict current-state and labelled reference modes.
- System Pressure remains daily / non-fallback / <=7 days stale.
- Sovereign spread levels may use latest valid non-fallback observations up to 120 days old.
- Spread legs now show separate observation dates and freshness labels.
- Daily spread change is suppressed unless both legs are comparable fresh daily data within 2 days.
- Curve levels may use recent reference observations when tenor dates are within 14 days.
- Steepening / flattening labels require comparable fresh daily tenor moves.
- Reference observations older than 120 days are rejected.
- Added deterministic `BondStats.selfTest()` and expanded health diagnostics.
- Public CTAs remain on bondstats.org by default.
