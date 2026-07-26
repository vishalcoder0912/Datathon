/**
 * AI Cascade Service
 * Priority: 1. Ollama (Local)
 *          2. Gemini API (Cloud)
 *          3. Local Fallback (Schema-based)
 */

import { isOllamaConfigured } from "./ollama-ai-service.js";
import { createChatResponse, classifyChatQuery } from "./analytics-service.js";
import { getCachedQuery, cacheQuery } from "./query-cache.js";
import { aiManager } from "./ai/ai-manager.js";
import { getModelForTask } from "../config/model-router.js";

const hasGeminiApiKey = () =>
  Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim());

export async function performAICascadeAnalysis(dataset, query) {
  console.log("\n[cascade] ====================================");
  console.log(`[cascade] Starting AI cascade for: "${query.substring(0, 30)}..."`);
  console.log("[cascade] Priority: Ollama -> Gemini -> Local");

  const queryType = classifyChatQuery(query);
  const cachedResult = getCachedQuery(dataset.id, query);

  if (cachedResult) {
    console.log("[cascade] CACHE HIT");
    return {
      ...cachedResult,
      fromCache: true,
      cascade: { stage: "cache", timestamp: new Date().toISOString() },
    };
  }

  console.log("[cascade] CACHE MISS - Proceeding");

  if (queryType !== "analysis") {
    console.log(`[cascade] Using local guided response for query type: ${queryType}`);
    const localResult = await tryLocalFallback(dataset, query);
    cacheQuery(dataset.id, query, localResult);
    return {
      ...localResult,
      cascade: { stage: "local", model: "Local Schema", timestamp: new Date().toISOString() },
    };
  }

  const ollamaResult = await tryOllamaAnalysis(dataset, query, queryType);
  if (ollamaResult.success) {
    console.log("[cascade] LEVEL 1: OLLAMA SUCCESS");
    cacheQuery(dataset.id, query, ollamaResult);
    return {
      ...ollamaResult,
      cascade: { stage: "ollama", model: ollamaResult.model || "Ollama", timestamp: new Date().toISOString() },
    };
  }

  console.log(`[cascade] OLLAMA FAILED: ${ollamaResult.error}`);
  console.log("[cascade] -> LEVEL 2: GEMINI");

  const geminiResult = await tryGeminiAnalysis(dataset, query);
  if (geminiResult.success) {
    console.log("[cascade] LEVEL 2: GEMINI SUCCESS");
    cacheQuery(dataset.id, query, geminiResult);
    return {
      ...geminiResult,
      cascade: { stage: "gemini", model: "Gemini 1.5 Flash", timestamp: new Date().toISOString() },
    };
  }

  console.log(`[cascade] GEMINI FAILED: ${geminiResult.error}`);
  console.log("[cascade] -> LEVEL 3: LOCAL FALLBACK");

  const localResult = await tryLocalFallback(dataset, query);
  console.log("[cascade] LEVEL 3: LOCAL SUCCESS");
  cacheQuery(dataset.id, query, localResult);
  return {
    ...localResult,
    cascade: { stage: "local", model: "Local Schema", timestamp: new Date().toISOString() },
  };
}

async function tryOllamaAnalysis(dataset, query, queryType) {
  try {
    const isAvailable = await isOllamaConfigured();
    if (!isAvailable) {
      return { success: false, error: "Ollama not available" };
    }

    const schemaSummary = (dataset.columns || [])
      .slice(0, 12)
      .map((column) => `${column.name} (${column.type || "unknown"})`)
      .join(", ");
    const prompt = `Answer in 2 short sentences as a dashboard data analyst.
Dataset: ${dataset.name}. Rows: ${dataset.rowCount || dataset.rows?.length || 0}. Columns: ${schemaSummary}.
Question: ${query}`;

    const cascadeModel = getModelForTask("main_analyst");

    const aiResponse = await aiManager.generateResponse(prompt, {
      preferredProvider: "ollama",
      preferredModel: cascadeModel,
      maxTokens: 40,
      temperature: 0.2,
      timeout: 10000,
      disableFallback: true,
    });

    if (!aiResponse.success || !aiResponse.content) {
      return { success: false, error: aiResponse.error || "Ollama did not return content" };
    }

    return {
      success: true,
      content: aiResponse.content,
      sql: null,
      chart: null,
      insights: [
        `Provider: ${aiResponse.provider || "ollama"}`,
        `Model: ${aiResponse.model || "Ollama"}`,
      ].filter(Boolean),
      intent: queryType,
      confidence: 0.8,
      usedAI: true,
      model: aiResponse.model || "Ollama",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function tryGeminiAnalysis(dataset, query) {
  try {
    if (!hasGeminiApiKey()) {
      return { success: false, error: "Gemini API key not configured" };
    }

    const { generateSQLFromSchema } = await import("./schema-ai-service.js");
    const { buildSchemaPacketAsync } = await import("./schema-packet-builder.js");

    const schemaPacket = await buildSchemaPacketAsync(dataset);
    const response = await generateSQLFromSchema(schemaPacket, query, { allowFallback: false });

    if (response.fallback || (!response.sql && response.intent === "unclear")) {
      return { success: false, error: "Gemini could not generate valid query" };
    }

    return {
      success: true,
      content: response.insight,
      sql: response.sql,
      intent: response.intent,
      confidence: response.confidence,
      usedAI: true,
      model: "Gemini 1.5 Flash",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function tryLocalFallback(dataset, query) {
  try {
    const response = await createChatResponse(dataset, query);
    return {
      success: true,
      content: response.content,
      sql: response.sql,
      chart: response.chart,
      insights: response.insights,
      intent: response.intent,
      confidence: response.confidence || 0.7,
      usedAI: false,
      model: response.model || "Local Schema Analysis",
      reason: response.reason,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getCascadeStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    levels: {
      ollama: { name: "Ollama", available: false },
      gemini: { name: "Google Gemini", available: hasGeminiApiKey() },
      local: { name: "Local Fallback", available: true },
    },
  };

  try {
    status.levels.ollama.available = await isOllamaConfigured();
  } catch {
    status.levels.ollama.available = false;
  }

  return status;
}
