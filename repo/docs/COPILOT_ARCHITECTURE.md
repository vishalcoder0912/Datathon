# Local Copilot Architecture

The Copilot uses an allowlisted-tool architecture. It never executes model-generated SQL.

```text
Question -> language/intent routing -> approved tool -> Zod validation
-> RBAC/scope check -> repository or analytics call -> structured result
-> local Ollama explanation -> citations/limitations -> audit record
```

Supported tools include overview, trends, district/station summaries, comparisons, hotspots, spikes, repeat-link profiles, case network, MO similarity, delays, risk areas, data quality, and intelligence briefs.

Ollama defaults to `qwen3:4b`, with `llama3.2:3b` as local fallback. If Ollama is unavailable, deterministic intent routing still calls the approved analytical tool and declares that the local model was unavailable. Unsupported questions receive a safe response rather than unrestricted query execution.

Copilot results contain `answer`, `toolUsed`, filters, data period, record count, source list, confidence, limitations, and follow-up suggestions. Each request is retained in `copilot_query` without raw credentials or unrestricted prompt data.
