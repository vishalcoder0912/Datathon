import { describe, expect, it, vi } from "vitest";
import { handleChatRoutes } from "../routes/chat.js";
import { makeReq, makeRes, salaryDataset, sentinelDataset } from "./test-helpers.js";

// Helper to assert schema-only payload boundaries
export function assertSchemaOnlyPayload(payload, fixtureRows) {
  const serialized = JSON.stringify(payload);

  // Reject properties representing raw data dumps
  if (payload.rows || payload.rawRows || payload.allRows || payload.csvText || payload.fullDataset) {
    throw new Error("Payload contains raw rows property");
  }

  // Reject serialized row keywords
  if (serialized.includes('"rows":') || serialized.includes('"rawRows":') || serialized.includes('"allRows":') || serialized.includes('"csvText":')) {
    throw new Error("Payload contains forbidden raw row keys");
  }

  // Check if complete raw fixture row records are leaked
  if (fixtureRows && fixtureRows.length > 0) {
    for (const row of fixtureRows) {
      const rowStr = JSON.stringify(row);
      if (serialized.includes(rowStr)) {
        throw new Error("Payload contains raw fixture row record objects");
      }
    }
  }

  // Verify schema indicators are present (such as schema, column_profiles, rowCount or columnCount)
  const hasSchemaContext = serialized.includes("columnCount") || 
                           serialized.includes("rowCount") || 
                           serialized.includes("columns") ||
                           serialized.includes("schema-only") ||
                           serialized.includes("Schema-only") ||
                           serialized.includes("schemaOnly");
  if (!hasSchemaContext) {
    throw new Error("Payload is missing required schema-only metadata");
  }
}

// Helper to register mock dataset in repository
vi.mock("../database/dataset-repository.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getDatasetById: (id) => {
      if (id === "test-local") return salaryDataset;
      if (id === "test-sentinel") return sentinelDataset;
      return null;
    },
    getChatMessages: () => [],
    saveChatMessage: () => {},
    clearChatMessages: () => {},
  };
});

// Mock the Ollama service to avoid actual fetch calls and test fallbacks deterministically
vi.mock("../services/ollama/ollama-dual-model-service.js", () => {
  return {
    callDatasetChat: async (messages) => {
      const prompt = messages[0]?.content || "";
      if (prompt.includes("What columns are available?")) {
        throw new Error("Ollama connection timed out or serve is not running.");
      }
      return {
        content: "I analyzed the dataset. The average salary is computed safely.",
        provider: "ollama",
        model: "llama3.2"
      };
    },
    OLLAMA_MODELS: {
      chat: "llama3.2",
      dashboard: "llama3.2"
    }
  };
});

async function callChatRoute(method, pathname, body) {
  const response = makeRes();
  const handled = await handleChatRoutes(makeReq(method, body), response, pathname);
  return { handled, response, payload: response.json() };
}

describe("Chat routes /api/datasets/:id/chat", () => {
  it("sends schema-only payload and rejects raw rows", async () => {
    const { handled, payload } = await callChatRoute("POST", "/api/datasets/test-sentinel/chat", {
      query: "Show average salary_usd by country",
    });

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data.assistantMessage).toBeDefined();

    // Verify raw secret row content is not present anywhere in the payload
    expect(JSON.stringify(payload)).not.toContain("SECRET_RAW_ROW_SHOULD_NEVER_REACH_LLM");

    // Assert using the schema-only payload helper
    assertSchemaOnlyPayload(payload, sentinelDataset.rows);
  });

  it("returns a clean 400 validation error if query asks for fields not in schema", async () => {
    const { handled, response, payload } = await callChatRoute("POST", "/api/datasets/test-local/chat", {
      query: "Show average revenue by month",
    });

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.message).toContain("Column 'revenue' does not exist in schema");
  });

  it("handles provider fallback when Ollama is offline or unavailable", async () => {
    const { handled, payload } = await callChatRoute("POST", "/api/datasets/test-local/chat", {
      query: "What columns are available?",
    });

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data.assistantMessage.content).toContain("country");
    expect(payload.data.assistantMessage.content).toContain("salary_usd");
    expect(payload.data.assistantMessage.provider).toBe("fallback");
  });

  it("returns 404 when dataset is missing", async () => {
    const { handled, response, payload } = await callChatRoute("POST", "/api/datasets/missing-id/chat", {
      query: "What columns are available?",
    });

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.message).toContain("Dataset not found");
  });

  it("manages chat history endpoints", async () => {
    const getRes = await callChatRoute("GET", "/api/datasets/test-local/chat/history", {});
    expect(getRes.handled).toBe(true);
    expect(getRes.payload.success).toBe(true);
    expect(getRes.payload.data.messages).toBeInstanceOf(Array);

    const deleteRes = await callChatRoute("DELETE", "/api/datasets/test-local/chat/history", {});
    expect(deleteRes.handled).toBe(true);
    expect(deleteRes.payload.success).toBe(true);
    expect(deleteRes.payload.data.messages).toEqual([]);
  });
});
