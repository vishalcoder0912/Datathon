import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { schemaSignature } from './schema-profiler.js';

const DEFAULT_MEMORY_PATH = path.resolve(process.cwd(), 'data/schema-agent-memory.jsonl');

function textHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const intersection = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return intersection / union;
}

function tokensFromSignature(signature) {
  return signature
    .split('|')
    .flatMap((part) => part.split(':'))
    .map((v) => v.toLowerCase().trim())
    .filter(Boolean);
}

export async function rememberSchema(profile, dashboardSpec, trainingExamples, options = {}) {
  const memoryPath = options.memoryPath || DEFAULT_MEMORY_PATH;
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });

  const signature = schemaSignature(profile);
  const record = {
    id: textHash(`${signature}:${profile.rowCount}:${new Date().toISOString()}`).slice(0, 16),
    createdAt: new Date().toISOString(),
    signature,
    fingerprint: textHash(JSON.stringify({
      signature,
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      columns: profile.columns.map((c) => [c.name, c.detectedType, c.role, c.uniqueCount]),
    })),
    datasetId: profile.datasetId,
    datasetName: profile.datasetName,
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    columns: profile.columns.map((c) => ({
      name: c.name,
      detectedType: c.detectedType,
      role: c.role,
      uniqueCount: c.uniqueCount,
      isMultiValue: c.isMultiValue,
    })),
    primaryTarget: dashboardSpec.primaryTarget,
    dashboardSpec,
    trainingExamples,
  };

  await fs.appendFile(memoryPath, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export async function readSchemaMemory(options = {}) {
  const memoryPath = options.memoryPath || DEFAULT_MEMORY_PATH;

  try {
    const raw = await fs.readFile(memoryPath, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function findSimilarSchemas(profile, options = {}) {
  const signature = schemaSignature(profile);
  const currentTokens = tokensFromSignature(signature);
  const records = await readSchemaMemory(options);

  return records
    .map((record) => ({
      ...record,
      similarity: jaccard(currentTokens, tokensFromSignature(record.signature || '')),
    }))
    .filter((record) => record.similarity >= (options.minSimilarity || 0.35))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit || 5);
}

export async function memoryStats(options = {}) {
  const records = await readSchemaMemory(options);
  const uniqueSignatures = new Set(records.map((r) => r.signature)).size;

  return {
    records: records.length,
    uniqueSignatures,
    latest: records.slice(-5).reverse().map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      datasetName: r.datasetName,
      rowCount: r.rowCount,
      primaryTarget: r.primaryTarget,
    })),
  };
}
