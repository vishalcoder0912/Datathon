import dotenv from "dotenv";

dotenv.config();

function envBool(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

export const vectorDbConfig = {
  provider: process.env.VECTOR_DB_PROVIDER || "qdrant",
  enabled: envBool("VECTOR_DB_ENABLED", false),
  fallbackJson: envBool("VECTOR_DB_FALLBACK_JSON", true),
  qdrant: {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY || undefined,
    schemaCollection: process.env.QDRANT_SCHEMA_COLLECTION || "insightflow_schema_memory",
    pdfCollection: process.env.QDRANT_PDF_COLLECTION || "insightflow_pdf_rag",
    pdfChunksCollection:
      process.env.QDRANT_PDF_CHUNKS_COLLECTION ||
      process.env.QDRANT_PDF_COLLECTION ||
      "insightflow_pdf_chunks",
    pdfSummariesCollection: process.env.QDRANT_PDF_SUMMARIES_COLLECTION || "insightflow_pdf_summaries",
    pdfTablesCollection: process.env.QDRANT_PDF_TABLES_COLLECTION || "insightflow_pdf_tables",
  },
  embedding: {
    provider: "ollama",
    model: process.env.PDF_EMBEDDING_MODEL || process.env.RAG_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || "nomic-embed-text:latest",
    ollamaBaseUrl:
      process.env.OLLAMA_BASE_URL ||
      process.env.OLLAMA_HOST ||
      "http://localhost:11434",
    timeoutMs: Number(process.env.RAG_EMBEDDING_TIMEOUT_MS || 12000),
  },
};

export function isQdrantEnabled() {
  return vectorDbConfig.enabled && vectorDbConfig.provider === "qdrant";
}

export default vectorDbConfig;
