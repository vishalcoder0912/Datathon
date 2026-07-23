import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  GEMINI_SYSTEM_PROMPT,
  GEMINI_CONFIG,
  TIMEOUT_CONFIG,
} from "../config/gemini-config.js";
import {
  buildSchemaPacketAsync,
  formatSchemaForPrompt,
  validateColumnsExist,
} from "./schema-packet-builder.js";

let lastGeminiConfigState = null;

const readGeminiApiKey = () =>
  process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured() {
  const configured = Boolean(readGeminiApiKey());

  if (lastGeminiConfigState !== configured) {
    console.log(`[gemini-ai] Config status: ${configured ? "CONFIGURED" : "NOT CONFIGURED"}`);
    lastGeminiConfigState = configured;
  }

  return configured;
}

/**
 * Call Gemini AI with schema packet
 */
export async function callGeminiAI(dataset, query) {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API key not configured");
  }

  try {
    // Build schema packet
    const schemaPacket = await buildSchemaPacketAsync(dataset);
    const schemaText = formatSchemaForPrompt(schemaPacket);

    // Initialize Gemini
    console.log("[gemini-ai] Initializing with model:", GEMINI_CONFIG.model);
    const genAI = new GoogleGenerativeAI(readGeminiApiKey());
    const model = genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      generationConfig: {
        temperature: GEMINI_CONFIG.temperature,
        topP: GEMINI_CONFIG.topP,
        topK: GEMINI_CONFIG.topK,
        maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
        responseMimeType: "application/json",
      },
      systemInstruction: GEMINI_SYSTEM_PROMPT,
    });

    // Prepare prompt
    const userPrompt = `
SCHEMA INFORMATION:
${schemaText}

USER QUERY:
"${query}"

Analyze this query and respond with JSON.
`;

    console.log("[gemini-ai] Sending request to Gemini...");
    console.log("[gemini-ai] Schema length:", schemaText.length, "chars");

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("API timeout")),
        TIMEOUT_CONFIG.API_CALL_MS
      );
    });

    // Make API call with timeout
    console.log("[gemini-ai] Waiting for response...");
    const response = await Promise.race([
      model.generateContent(userPrompt),
      timeoutPromise,
    ]);
    console.log("[gemini-ai] Response received, parsing...");

    // Parse response
    const responseText = response.response.text();
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[gemini-ai] JSON parse error:", parseError.message);
      console.error("[gemini-ai] Raw response:", responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Gemini: ${responseText.substring(0, 100)}`);
    }

    // Validate columns
    validateColumnsExist(aiResponse.columns_used, schemaPacket);

    return {
      success: true,
      ...aiResponse,
      usedAI: true,
    };
  } catch (error) {
    console.warn("[gemini-ai] Error:", error.message);
    return {
      success: false,
      error: error.message,
      usedAI: false,
      shouldFallback: true,
    };
  }
}

/**
 * Validate AI response structure
 */
export function validateAIResponse(response) {
  const required = ["intent", "columns_used", "sql", "insight", "chart_type", "confidence"];
  const errors = [];

  for (const field of required) {
    if (!(field in response)) {
      errors.push(`Missing: ${field}`);
    }
  }

  if (typeof response.confidence !== "number" || response.confidence < 0 || response.confidence > 1) {
    errors.push("Invalid confidence");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize SQL query for execution
 */
export function sanitizeSQL(sql) {
  if (!sql) return null;
  return sql.replace(/```sql/g, "").replace(/```/g, "").trim();
}

/**
 * Get confidence description
 */
export function getConfidenceLevel(score) {
  if (score >= 0.9) return "High";
  if (score >= 0.7) return "Medium";
  return "Low";
}
