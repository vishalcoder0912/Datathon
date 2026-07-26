import { buildSchemaProfile } from "./schema-fingerprint.js";
import { applyTrainedTemplates, mergePlans } from "./dashboard-plan-engine.js";
import { embedText } from "./schema-rag-embeddings.js";
import {
  buildSchemaRagMemoryEntry,
  removeEmbeddingsForPublicResponse,
  schemaProfileToRagText,
} from "./schema-rag-memory-builder.js";
import {
  getSchemaRagStatsSmart,
  retrieveSchemaRagMemorySmart,
  upsertSchemaRagMemorySmart,
} from "./schema-rag-store.js";

function toPublicMatch(match) {
  return {
    ...match,
    entry: removeEmbeddingsForPublicResponse(match.entry),
  };
}

export async function retrieveSchemaRagMemories(schemaProfile, options = {}) {
  const limit = Number(options.limit || 5);
  const threshold = Number(options.threshold ?? 0.50);
  const profile = schemaProfile?.columns ? schemaProfile : buildSchemaProfile(schemaProfile || {});
  const queryText = schemaProfileToRagText(profile);

  const result = await retrieveSchemaRagMemorySmart(
    {
      id: profile.id || profile.signature,
      domain: profile.domain,
      schemaSignature: profile.signature,
      schemaProfile: profile,
      schemaText: queryText,
      memoryText: queryText,
      columns: profile.columns || [],
    },
    {
      limit,
      minScore: threshold,
      useOllama: options.useOllama,
    }
  );

  return {
    used: result.matches.length > 0,
    threshold,
    query: result.query,
    matches: result.matches.map(toPublicMatch),
    mode: result.mode,
    fallback: result.fallback,
    vectorError: result.vectorError,
    stats: await getSchemaRagStatsSmart(),
  };
}

export function buildRagDashboardPlan(profile, matches = []) {
  const plans = (matches || [])
    .map((match) => {
      const entry = match.entry || match;
      return applyTrainedTemplates(profile, {
        entry: {
          ...entry,
          name: entry.name || entry.id,
          domain: entry.domain || profile.domain,
          dashboardPlan: entry.dashboardPlan || {},
        },
        score: match.score || 0,
      });
    })
    .filter(Boolean);

  if (!plans.length) return null;

  return mergePlans(profile, ...plans.map((plan) => ({
    ...plan,
    source: `rag:${plan.source || "memory"}`,
  })));
}

export async function trainSchemaRagMemoryFromDataset({
  dataset,
  schemaProfile,
  acceptedDashboardPlan,
  dashboardPlan,
  rating = "good",
  notes = "",
  source = "user-feedback",
  useOllama,
} = {}) {
  const profile = schemaProfile?.columns ? schemaProfile : buildSchemaProfile(dataset || {});
  const schemaText = schemaProfileToRagText(profile);

  const embeddingResult = await embedText(schemaText, {
    useOllama,
    allowFallback: true,
  });

  const entry = buildSchemaRagMemoryEntry({
    dataset,
    schemaProfile: profile,
    dashboardPlan: acceptedDashboardPlan || dashboardPlan || {},
    embedding: embeddingResult.embedding,
    rating,
    notes,
    source,
  });

  const saved = await upsertSchemaRagMemorySmart(entry);

  return {
    entry: removeEmbeddingsForPublicResponse(saved),
    embedding: {
      provider: embeddingResult.provider,
      model: embeddingResult.model,
      fallback: embeddingResult.fallback,
      error: embeddingResult.error,
    },
    stats: await getSchemaRagStatsSmart(),
  };
}
