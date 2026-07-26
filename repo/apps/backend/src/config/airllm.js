// AirLLM is intentionally config-only here.
// It must never be used for COUNT, SUM, AVG, GROUP BY, chart values, row scanning,
// or dashboard refresh. Deterministic engines such as DuckDB/Polars own those paths.
export const AIRLLM_CONFIG = Object.freeze({
  enabled: process.env.ENABLE_AIRLLM_DEEP_REASONER === "true",
  model: process.env.AIRLLM_MODEL || "Qwen/Qwen2.5-14B-Instruct",
  compression: process.env.AIRLLM_COMPRESSION || "4bit",
  allowedUses: [
    "deep schema reasoning",
    "business-domain explanation",
    "offline training data generation",
    "final narrative improvement",
  ],
  forbiddenUses: [
    "COUNT",
    "SUM",
    "AVG",
    "GROUP BY",
    "chart values",
    "row scanning",
    "dashboard refresh",
  ],
});

export default AIRLLM_CONFIG;
