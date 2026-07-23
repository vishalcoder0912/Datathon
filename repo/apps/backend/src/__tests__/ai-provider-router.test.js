import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { aiProviderRouter } from "../services/ai-providers/ai-router.js";
import { geminiService } from "../services/ai-providers/gemini-service.js";
import { ollamaService } from "../services/ai-providers/ollama-service.js";

describe("AI Provider Router Service", () => {
  beforeEach(() => {
    vi.spyOn(geminiService, "isAvailable").mockReturnValue(true);
    vi.spyOn(ollamaService, "isAvailable").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chooses Gemini as primary if both available for chatbot", () => {
    const route = aiProviderRouter.getProviderForTask("chatbot");
    expect(route.provider).toBe("gemini");
  });

  it("uses Ollama in local_only mode", () => {
    process.env.AI_PROVIDER_MODE = "local_only";
    const route = aiProviderRouter.getProviderForTask("chatbot");
    expect(route.provider).toBe("ollama");
    delete process.env.AI_PROVIDER_MODE;
  });

  it("uses Gemini in cloud_only mode", () => {
    process.env.AI_PROVIDER_MODE = "cloud_only";
    const route = aiProviderRouter.getProviderForTask("chatbot");
    expect(route.provider).toBe("gemini");
    delete process.env.AI_PROVIDER_MODE;
  });

  it("hybrid_best races and selects higher scoring provider", async () => {
    const schemaPacket = {
      datasetName: "Salary Data",
      rowCount: 100,
      columns: [{ name: "country", type: "string", role: "dimension" }]
    };

    vi.spyOn(geminiService, "generateDashboardAction").mockResolvedValue({
      success: true,
      model: "gemini-2.5-flash",
      latency_ms: 1000,
      parsed: {
        response_type: "dashboard_action",
        schema_safe: true,
        natural_response: "Gemini response",
        actions: [{ action: "create_chart", chart_type: "pie", x: "country" }]
      }
    });

    vi.spyOn(ollamaService, "generateDashboardAction").mockResolvedValue({
      success: true,
      model: "qwen3:8b",
      latency_ms: 2000,
      parsed: {
        response_type: "dashboard_action",
        schema_safe: true,
        natural_response: "Ollama response",
        actions: [
          { action: "create_chart", chart_type: "pie", x: "country" },
          { action: "create_chart", chart_type: "pie", x: "country" },
          { action: "create_chart", chart_type: "pie", x: "country" },
          { action: "create_chart", chart_type: "pie", x: "country" }
        ]
      }
    });

    const result = await aiProviderRouter.runAITask({
      taskType: "dashboard_planner",
      schemaPacket,
      userQuery: "build dashboard",
      preferredMode: "hybrid_best"
    });

    // Gemini should win because it has fewer actions (better score) and lower latency
    expect(result.success).toBe(true);
    expect(result.provider).toBe("gemini");
  });

  it("falls back to Ollama if Gemini fails in hybrid mode", async () => {
    vi.spyOn(geminiService, "generateDashboardAction").mockResolvedValue({
      success: false,
      error: "API key invalid"
    });

    vi.spyOn(ollamaService, "generateDashboardAction").mockResolvedValue({
      success: true,
      model: "qwen3:8b",
      parsed: {
        response_type: "dashboard_action",
        schema_safe: true,
        actions: []
      }
    });

    const result = await aiProviderRouter.runAITask({
      taskType: "dashboard_planner",
      schemaPacket: { columns: [] },
      userQuery: "Show charts",
      preferredMode: "hybrid"
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("ollama");
  });

  it("handles total failure gracefully without crashing", async () => {
    vi.spyOn(geminiService, "generateDashboardAction").mockRejectedValue(new Error("Network dead"));
    vi.spyOn(ollamaService, "generateDashboardAction").mockRejectedValue(new Error("Ollama dead"));

    const result = await aiProviderRouter.runAITask({
      taskType: "dashboard_planner",
      schemaPacket: { columns: [] },
      userQuery: "Show charts",
      preferredMode: "hybrid"
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("safe_fallback");
  });
});
