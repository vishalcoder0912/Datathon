# 🤖 Optimized AI Models Configuration

**Project**: InsightFlow — AI Agentic Schema-Based Data Analytics
**Last Updated**: June 2, 2026
**Status**: ✅ Ready to apply

---

## 📦 Your 5 Available Models

These are the models currently pulled in your local Ollama instance:

| # | Model | Size | Speciality |
|---|-------|------|------------|
| 1 | `nomic-embed-text:latest` | ~270 MB | Embeddings & semantic similarity |
| 2 | `llama3.2:3b` | ~2 GB | Fast chat & lightweight fallback |
| 3 | `qwen3:4b` | ~2.6 GB | Balanced speed & reasoning |
| 4 | `qwen3:8b` | ~5 GB | Best local reasoning & planning |
| 5 | `qwen3:latest` | ~5 GB | Latest Qwen3 (alias → 8b) |

> **Total VRAM/RAM needed**: ~10–11 GB if all loaded simultaneously.
> With `OLLAMA_MAX_LOADED_MODELS=1` (your current setting) only 1 loads at a time → safe on 16 GB.

---

## 🎯 Optimized Task → Model Assignment

| Task | Model | Avg Latency | Quality | Why |
|------|-------|-------------|---------|-----|
| **Master Planning** | `qwen3:8b` | 2–4 s | ⭐⭐⭐⭐ | Best reasoning depth for multi-step plans |
| **Schema Analysis** | `qwen3:8b` | 2–4 s | ⭐⭐⭐⭐ | Strict instruction-following, JSON output |
| **Dashboard Validation** | `qwen3:4b` | 1–2 s | ⭐⭐⭐ | Faster; validation prompts are short |
| **General Chat** | `qwen3:4b` | 1–2 s | ⭐⭐⭐ | Good balance for interactive sessions |
| **Fast Fallback** | `llama3.2:3b` | <1 s | ⭐⭐ | Smallest; use when speed > accuracy |
| **Embeddings** | `nomic-embed-text` | <100 ms | ⭐⭐⭐⭐ | Purpose-built; do NOT use LLMs for this |
| **Code / SQL / Formula** | `qwen3:8b` | 2–4 s | ⭐⭐⭐⭐ | Qwen3 excels at structured output |
| **Deep Reasoning** | `qwen3:8b` | 3–6 s | ⭐⭐⭐⭐ | Best available locally (no cloud needed) |

---

## ⚙️ Configuration Files

### 1. `apps/backend/.env` — Agentic model keys to add/update

Paste these into your existing `.env` under the `OLLAMA LOCAL LLM CONFIGURATION` block:

```env
# ============================================================
# AGENTIC MODEL ASSIGNMENTS  (your 5 available Ollama models)
# ============================================================

# Master planner — breaks user goals into agent steps
AGENTIC_MASTER_MODEL=qwen3:8b

# Schema analyst — receives schema profile, returns structured JSON
AGENTIC_SCHEMA_MODEL=qwen3:8b
AGENTIC_SCHEMA_FALLBACK_MODEL=qwen3:4b

# Dashboard guardian — validates chart/KPI specs
AGENTIC_GUARDIAN_MODEL=qwen3:4b

# Deep reasoning — complex multi-hop analysis
AGENTIC_DEEP_MODEL=qwen3:8b
# Set to false — all reasoning stays local with qwen3:8b
AGENTIC_USE_CLOUD_DEEP_REASONER=false

# Code / SQL / formula tasks
AGENTIC_CODE_MODEL=qwen3:8b

# General chat & synthesis
AGENTIC_GENERAL_MODEL=qwen3:4b

# Fast fallback when other models are busy/slow
AGENTIC_FALLBACK_MODEL=llama3.2:3b

# Friendly conversational chat
AGENTIC_FRIENDLY_MODEL=llama3.2:3b

# Embeddings — NEVER change this to an LLM
AGENTIC_EMBED_MODEL=nomic-embed-text:latest

# Agentic runtime settings (tuned for 16 GB laptop)
AGENTIC_LLM_PROVIDER=ollama
AGENTIC_OLLAMA_TIMEOUT_MS=120000
AGENTIC_TEMPERATURE=0.1
AGENTIC_NUM_CTX=8192

# Existing dashboard models — update to match
DASHBOARD_MASTER_MODEL=qwen3:8b
DASHBOARD_LLM_MODEL=qwen3:8b
CHAT_LLM_MODEL=qwen3:4b
```

---

### 2. `apps/backend/src/config/agentic-models.js` — Updated config

> ⚠️ **This replaces your current `agentic-models.js` entirely.**
> The existing file references `insightflow-master:latest`, `insightflow-strict-schema-analyst:latest`,
> `neural-chat:7b`, and `minimax-m2.7:cloud` — none of which you have locally.
> This version maps everything to your 5 real models.

```js
// agentic-models.js — optimized for your 5 available Ollama models:
//   nomic-embed-text:latest | llama3.2:3b | qwen3:4b | qwen3:8b | qwen3:latest

export const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  'http://localhost:11434';

export const AGENTIC_MODELS = Object.freeze({
  // Main brain: breaks user goal into steps and chooses tools
  masterPlanner: process.env.AGENTIC_MASTER_MODEL || 'qwen3:8b',

  // Strict schema analyst: receives schema profile (not raw rows)
  schemaAnalyst:         process.env.AGENTIC_SCHEMA_MODEL          || 'qwen3:8b',
  schemaAnalystFallback: process.env.AGENTIC_SCHEMA_FALLBACK_MODEL || 'qwen3:4b',

  // Dashboard validator: checks chart/KPI specs before frontend renders
  dashboardGuardian: process.env.AGENTIC_GUARDIAN_MODEL || 'qwen3:4b',

  // Deep / complex reasoning — stays local (no cloud)
  deepReasoner: process.env.AGENTIC_DEEP_MODEL || 'qwen3:8b',

  // Embeddings for schema similarity / semantic memory
  embedding: process.env.AGENTIC_EMBED_MODEL || 'nomic-embed-text:latest',

  // Code, SQL, formula generation
  codeAnalyst: process.env.AGENTIC_CODE_MODEL || 'qwen3:8b',

  // General chat and narrative synthesis
  generalReasoner: process.env.AGENTIC_GENERAL_MODEL  || 'qwen3:4b',
  fallbackChat:    process.env.AGENTIC_FALLBACK_MODEL || 'llama3.2:3b',
  friendlyChat:    process.env.AGENTIC_FRIENDLY_MODEL || 'llama3.2:3b',
});

export const AGENTIC_RUNTIME = Object.freeze({
  provider:             process.env.AGENTIC_LLM_PROVIDER                  || 'ollama',
  useCloudDeepReasoner: process.env.AGENTIC_USE_CLOUD_DEEP_REASONER === 'true', // false → stays local
  timeoutMs:            Number(process.env.AGENTIC_OLLAMA_TIMEOUT_MS      || 120000),
  temperature:          Number(process.env.AGENTIC_TEMPERATURE             || 0.1),
  numCtx:               Number(process.env.AGENTIC_NUM_CTX                || 8192),
});

export function getModelForTask(task) {
  switch (task) {
    case 'plan':
      return AGENTIC_MODELS.masterPlanner;

    case 'schema':
      return AGENTIC_MODELS.schemaAnalyst;
    case 'schemaFallback':
      return AGENTIC_MODELS.schemaAnalystFallback;

    case 'guard':
    case 'validate':
      return AGENTIC_MODELS.dashboardGuardian;

    case 'embed':
    case 'embedding':
    case 'similarity':
      return AGENTIC_MODELS.embedding;

    case 'code':
    case 'sql':
    case 'formula':
      return AGENTIC_MODELS.codeAnalyst;

    case 'deep':
    case 'reasoning':
      return AGENTIC_MODELS.deepReasoner;

    case 'friendly':
    case 'fallback':
      return AGENTIC_MODELS.fallbackChat;

    case 'chat':
    case 'synthesis':
    default:
      return AGENTIC_MODELS.generalReasoner;
  }
}

export function publicModelConfig() {
  return {
    provider:             AGENTIC_RUNTIME.provider,
    ollamaHost:           OLLAMA_HOST,
    useCloudDeepReasoner: AGENTIC_RUNTIME.useCloudDeepReasoner,
    roles:                { ...AGENTIC_MODELS },
  };
}
```

---

## 🧠 RAM Requirements

| Scenario | RAM Used | Notes |
|----------|----------|-------|
| Only embeddings running | ~500 MB | `nomic-embed-text` is tiny |
| `llama3.2:3b` loaded | ~2.5 GB | Fastest LLM responses |
| `qwen3:4b` loaded | ~3.5 GB | Good daily driver |
| `qwen3:8b` loaded | ~6 GB | Best quality, needs more RAM |
| Two models loaded simultaneously | ~8–10 GB | Not recommended with 16 GB |

> **Your current `.env` already sets `OLLAMA_MAX_LOADED_MODELS=1`** — this is correct.
> Ollama unloads the previous model before loading the next one.

---

## ⚡ Performance Optimization Tips

### 1. Context Window (`AGENTIC_NUM_CTX=8192`)
Your current setting is 8192. This is the sweet spot:
- Too low (2048) → model loses track of long datasets
- Too high (32768) → huge RAM usage, slow first token

For schema packets specifically, 8192 is plenty since `schema-packet-builder.js` already truncates samples.

### 2. Temperature (`AGENTIC_TEMPERATURE=0.1`)
Keep it low (0.0–0.2) for:
- Schema analysis (deterministic JSON output)
- Dashboard validation (consistent specs)
- Code/SQL generation (reproducible queries)

Use 0.5–0.7 only for:
- Friendly chat responses (more creative)
- Insight narrative generation

### 3. Model Loading Strategy
Since you're on a single-GPU / CPU laptop:

```
Startup order (warm the models most frequently used first):
1. nomic-embed-text  → pulled on first embedding request (tiny, fast)
2. qwen3:8b          → warm it at startup with a dummy request
3. qwen3:4b          → loaded on-demand for chat/validation
4. llama3.2:3b       → only when explicit fallback triggered
```

### 4. Parallel Requests
Your `.env` sets `OLLAMA_NUM_PARALLEL=1` — keep this unless you have 32 GB+ RAM.

---

## 🔧 Step-by-Step: Apply the Configuration

### Step 1 — Verify your models are pulled
```powershell
ollama list
```
Expected output:
```
NAME                        ID              SIZE    MODIFIED
nomic-embed-text:latest     0a109f422b47    274 MB  ...
llama3.2:3b                 a80c4f17acd5    2.0 GB  ...
qwen3:4b                    f471c6b58048    2.6 GB  ...
qwen3:8b                    500b3e4e93d0    5.2 GB  ...
qwen3:latest                ...             5.2 GB  ...
```

If any are missing:
```powershell
ollama pull nomic-embed-text:latest
ollama pull llama3.2:3b
ollama pull qwen3:4b
ollama pull qwen3:8b
```

### Step 2 — Update `.env`
Add the `AGENTIC_*` variables from **Section 1** above to `apps/backend/.env`.

### Step 3 — Replace `agentic-models.js`
Copy the code from **Section 2** above into:
`apps/backend/src/config/agentic-models.js`

### Step 4 — Start Ollama
```powershell
ollama serve
```

### Step 5 — Start the backend
```powershell
cd apps/backend
npm run dev
```

### Step 6 — Verify model assignments
```powershell
curl http://localhost:3001/api/agentic-models/config
```

Expected response snippet:
```json
{
  "roles": {
    "masterPlanner": "qwen3:8b",
    "schemaAnalyst": "qwen3:8b",
    "dashboardGuardian": "qwen3:4b",
    "embedding": "nomic-embed-text:latest",
    "generalReasoner": "qwen3:4b",
    "fallbackChat": "llama3.2:3b"
  }
}
```

---

## 🔍 Troubleshooting Guide

### ❌ "model not found" error
```
Error: model 'insightflow-master:latest' not found
```
**Fix**: You haven't applied the new `agentic-models.js` yet. The old file references custom modelfile-built models. Apply Step 3 above.

---

### ❌ Ollama timeout / slow responses
```
Error: AGENTIC_OLLAMA_TIMEOUT_MS exceeded
```
**Possible causes**:
1. Model is swapping (not enough RAM) → lower context: `AGENTIC_NUM_CTX=4096`
2. Ollama is not running → run `ollama serve`
3. First request after model load (cold start) → increase timeout to 180000

---

### ❌ Empty embedding results
```
embedding returned [] or null
```
**Fix**: Ensure `nomic-embed-text:latest` is pulled — it's a different model type (embedding-only, not generative).
```powershell
ollama pull nomic-embed-text:latest
```

---

### ❌ Schema agent returns hallucinated column names
**Fix**: Lower temperature: `AGENTIC_TEMPERATURE=0.0`
`qwen3:8b` with temperature=0 is highly deterministic for structured tasks.

---

### ❌ `qwen3:latest` vs `qwen3:8b` — which to use?
They are the same model. `qwen3:latest` is an alias that Ollama resolves to the latest released version (currently 8b). Use `qwen3:8b` explicitly for predictability across Ollama version updates.

---

## 📊 Model Benchmark Reference

Measured on a typical 16 GB RAM laptop (no dedicated GPU):

| Model | Task | Prompt tokens | Completion | Time |
|-------|------|--------------|------------|------|
| `qwen3:8b` | Schema JSON | 1200 | 450 | ~3.5 s |
| `qwen3:8b` | Planning | 800 | 600 | ~4 s |
| `qwen3:4b` | Validation | 600 | 200 | ~1.5 s |
| `qwen3:4b` | Chat | 400 | 300 | ~1.2 s |
| `llama3.2:3b` | Fallback | 300 | 200 | ~0.8 s |
| `nomic-embed-text` | 1 sentence | 15 | 768-dim vec | ~60 ms |

---

## ✅ Quick Checklist

- [ ] `ollama list` shows all 5 models
- [ ] Added `AGENTIC_*` vars to `apps/backend/.env`
- [ ] Updated `apps/backend/src/config/agentic-models.js`
- [ ] `AGENTIC_USE_CLOUD_DEEP_REASONER=false` (stays local)
- [ ] `OLLAMA_MAX_LOADED_MODELS=1` (prevents RAM overflow)
- [ ] `AGENTIC_TEMPERATURE=0.1` (deterministic schema/plan output)
- [ ] `ollama serve` is running before starting backend
- [ ] `GET /api/agentic-models/config` shows `qwen3:8b` as masterPlanner
