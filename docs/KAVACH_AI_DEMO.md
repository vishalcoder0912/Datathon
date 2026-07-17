# KAVACH AI Demo Walkthrough

This document supersedes the original file-backed KAVACH demo notes.

> Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.

## Current prototype flow

1. Start PostgreSQL/PostGIS, run the migrations and seed the synthetic demo records as described in [LOCAL_DEMO_GUIDE.md](LOCAL_DEMO_GUIDE.md).
2. Sign in with the locally seeded account.
3. From Dashboard, open a reviewed or active spike alert.
4. In Geo Intelligence, select a synthetic district overlay and then a station marker; inspect the scoped, explainable hotspot evidence.
5. In Network Intelligence, select an edge to open its case-backed evidence drawer.
6. Open a masked person-link profile to inspect historical accused-case links and retrieve similar modus-operandi cases. These indicators are not guilt assessments or predictions.
7. Generate an HTML or PDF intelligence report. Its metadata, verification hash, disclaimer, filters, and audit event are persisted in PostgreSQL.

The current implementation has PostgreSQL persistence, authentication, role and geographic scope, audit trails, data-quality monitoring, and deterministic local Copilot tools. The synthetic geo overlays are illustrative only, not operational jurisdiction boundaries.

For exact setup commands, verification steps, and the supported offline demo fallback, see [LOCAL_DEMO_GUIDE.md](LOCAL_DEMO_GUIDE.md). For the complete implementation state and production gaps, see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
