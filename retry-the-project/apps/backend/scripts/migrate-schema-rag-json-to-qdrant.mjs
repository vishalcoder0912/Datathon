#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upsertSchemaRagVectorMemory } from "../src/services/ai-analyst/schema-rag-vector-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const defaultMemoryPath = path.join(backendRoot, "data", "schema-rag-memory.json");
const memoryPath = path.resolve(process.env.SCHEMA_RAG_MEMORY_PATH || defaultMemoryPath);

function readMemory() {
  if (!fs.existsSync(memoryPath)) return [];

  const parsed = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

const memories = readMemory();
let migrated = 0;
let failed = 0;

for (const memory of memories) {
  try {
    await upsertSchemaRagVectorMemory(memory);
    migrated += 1;
  } catch (error) {
    failed += 1;
    console.error(`Failed to migrate ${memory.id || memory.schemaSignature || "unknown"}: ${error.message}`);
  }
}

console.log(`Schema RAG migration complete. Migrated: ${migrated}. Failed: ${failed}. Source: ${memoryPath}`);
