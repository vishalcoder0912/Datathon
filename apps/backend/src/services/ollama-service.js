import {
  buildSchemaPacketAsync,
  formatSchemaForPrompt,
  validateColumnsExist,
} from "./schema-packet-builder.js";
import { GEMINI_SYSTEM_PROMPT, OLLAMA_CONFIG } from "../config/gemini-config.js";

const OLLAMA_URL = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL
  ? `${process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL}/api/generate`
  : "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";
const OLLAMA_TIMEOUT_MS = OLLAMA_CONFIG.timeout || 120000;

export async function callOllamaAI(dataset, query, preferences = {}) {
  try {
    const schemaPacket = await buildSchemaPacketAsync(dataset);
    const schemaText = formatSchemaForPrompt(schemaPacket);

    const chartCount = preferences.chartCount || "auto";
    const chartTypes = preferences.chartTypes?.join(", ") || "auto";
    const showTrends = preferences.showTrends !== false;
    const showCorrelations = preferences.showCorrelations !== false;

    const userPrompt = `${GEMINI_SYSTEM_PROMPT}

DATASET SCHEMA:
${schemaText}

USER QUERY: ${query}

USER PREFERENCES:
- Chart count: ${chartCount}
- Chart types: ${chartTypes}
- Show trends: ${showTrends}
- Show correlations: ${showCorrelations}

Analyze this query and respond with ONLY valid JSON. No markdown blocks. No explanations.`;

    console.log(`[ollama-ai] Sending request to local Ollama (${OLLAMA_MODEL}) at ${OLLAMA_URL}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: userPrompt,
        stream: false,
        format: "json",
        options: {
          temperature: OLLAMA_CONFIG.temperature,
          top_p: OLLAMA_CONFIG.topP,
          top_k: OLLAMA_CONFIG.topK,
          num_predict: OLLAMA_CONFIG.maxOutputTokens,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response;

    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[ollama-ai] JSON parse error:", parseError.message);
      const cleanedResponse = extractJSONfromResponse(responseText);
      if (cleanedResponse) {
        aiResponse = cleanedResponse;
      } else {
        throw new Error("Invalid JSON response from Ollama");
      }
    }

    if (aiResponse.columns_used) {
      validateColumnsExist(aiResponse.columns_used, schemaPacket);
    }

    return {
      success: true,
      ...aiResponse,
      usedAI: true,
      provider: "ollama",
      model: OLLAMA_MODEL,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("[ollama-ai] Request timed out, falling back...");
    } else {
      console.warn(`[ollama-ai] Error: ${error.message}`);
    }
    return {
      success: false,
      error: error.message,
      usedAI: false,
      shouldFallback: true,
    };
  }
}

function extractJSONfromResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
  return null;
}
