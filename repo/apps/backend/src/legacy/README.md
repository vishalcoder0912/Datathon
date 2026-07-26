# Legacy Backend Reference

These files are preserved for historical reference and are not part of the active backend runtime.

The canonical local runtime is:

```text
src/index.js -> src/core/server.js -> src/routes/index.js
```

Legacy route variants live in `src/legacy/routes/`. The archived Express/serverless entrypoints live in `src/legacy/runtime/` and `apps/backend/legacy/`.
