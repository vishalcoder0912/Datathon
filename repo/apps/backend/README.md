# Backend Structure

Path: `apps/backend`

## Key Folders

```text
data/                         Local SQLite files
src/
  index.js                    Canonical backend entrypoint
  core/server.js              Node HTTP server
  routes/index.js             Active route aggregator
  database/                   Dataset persistence and chat history storage
  services/                   Analytics and response generation
  legacy/                     Archived route/runtime experiments
legacy/                       Archived serverless adapter
```

## Placement Rules

- Keep request handling and route branching in `src/routes/index.js`.
- Start the backend through `src/index.js`; it binds to port `3001` by default.
- Put SQLite access and persistence logic in `src/database`.
- Put analytics and response-building logic in `src/services`.
- The frontend runs on port `5173` and proxies `/api` to this backend.
