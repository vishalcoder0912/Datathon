# Performance Report

Audit date: 2026-06-04

## Build Output

`npm run build:frontend` passed.

Largest chunks:

- `index`: 470.56 kB, gzip 158.07 kB.
- `charts`: 445.89 kB, gzip 116.55 kB.
- `EliteDashboardPage`: 209.37 kB, gzip 67.55 kB.
- `vendor`: 162.72 kB, gzip 53.10 kB.

## React Doctor

285 warnings:

- Bugs: 74.
- Performance: 119.
- Accessibility: 53.
- Maintainability: 39.

High-signal performance categories:

- Heavy libraries loaded eagerly in chart components.
- Full Framer Motion imports.
- Large components.
- Chained array iterations.
- Array lookup/find inside loops.
- Intl formatter rebuilt per call.
- Unstable context provider values.

## Live Validation

Performance score was 0 in live validation. The tool currently treats non-recovery and console errors as performance failure evidence.

## Recommendation

Start with lazy-loading heavy chart/ML surfaces and fixing stuck chat requests. Then optimize dashboard calculation loops only after guardrails and correctness are stable.
