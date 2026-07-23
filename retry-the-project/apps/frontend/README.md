# Frontend Structure

Path: `apps/frontend`

Local development runs on port `5173`. API requests should use relative `/api/*`
paths so Vite can proxy them to the backend on port `3001`.

## Key Folders

```text
public/                       Static assets
src/
  app/                        App bootstrap, router, providers
  features/                   Dashboard, chat, data flows
  shared/components/          Shared UI primitives and navigation
  shared/hooks/               Reusable hooks
  shared/layout/              App shell layout
  shared/lib/                 Shared utility helpers
  test/                       Vitest tests and setup
```

## Placement Rules

- Put route wiring and providers in `src/app`.
- Put domain-specific screens and logic in `src/features`.
- Put reusable primitives and helpers in `src/shared`.
