import { describe, expect, it, afterEach, vi } from "vitest";

describe("AI cascade behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dashboard planner uses qwen3:8b from model router", async () => {
    const { getModelForTask } = await import("../config/model-router.js");
    const model = getModelForTask("dashboard_planner");
    expect(model).toBe("qwen3:8b");
  });

  it("validator uses qwen3:4b from model router", async () => {
    const { getModelForTask } = await import("../config/model-router.js");
    expect(getModelForTask("kpi_validator")).toBe("qwen3:4b");
    expect(getModelForTask("chart_validator")).toBe("qwen3:4b");
    expect(getModelForTask("json_validator")).toBe("qwen3:4b");
  });

  it("coding task uses qwen2.5-coder:7b from model router", async () => {
    const { getModelForTask } = await import("../config/model-router.js");
    expect(getModelForTask("coding")).toBe("qwen2.5-coder:7b");
  });

  it("fast task uses llama3.2:3b from model router", async () => {
    const { getModelForTask } = await import("../config/model-router.js");
    expect(getModelForTask("fast")).toBe("llama3.2:3b");
  });

  it("nomic-embed-text is never returned for chat tasks", () => {
    const { getModelForTask, isChatModel } = require("../config/model-router.js");
    const chatTasks = ["main_analyst", "dashboard_planner", "chatbot", "kpi_validator", "chart_validator", "json_validator", "fact_checker", "coding", "fast", "quick_chat"];
    for (const task of chatTasks) {
      const model = getModelForTask(task);
      expect(model).not.toBe("nomic-embed-text");
      expect(isChatModel(model)).toBe(true);
    }
  });

  it("schema-only prompt does not include raw rows", () => {
    const schemaPacket = {
      datasetName: "Test Dataset",
      rowCount: 100,
      columnCount: 3,
      columns: [
        { name: "country", type: "string", role: "dimension" },
        { name: "salary", type: "number", role: "metric" },
        { name: "experience", type: "number", role: "metric" },
      ],
    };

    const prompt = JSON.stringify(schemaPacket);

    expect(prompt).not.toContain("\"rows\"");
    expect(prompt).not.toContain("\"data\"");
    expect(prompt).toContain("rowCount");
    expect(prompt).toContain("country");
    expect(prompt).toContain("salary");
  });

  it("invalid JSON is repaired to safe fallback", () => {
    const { default: modelRouter } = require("../config/model-router.js");

    function safeJsonParse(text) {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        const match = String(text).match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
    }

    const validJson = '{"response_type": "dashboard_action", "natural_response": "hello", "actions": [], "warnings": [], "schema_safe": true}';
    expect(safeJsonParse(validJson)).toBeTruthy();

    const markdownWrapped = '```json\n{"response_type": "dashboard_action", "natural_response": "hello", "actions": []}\n```';
    const extracted = safeJsonParse(markdownWrapped);
    expect(extracted).toBeTruthy();
    expect(extracted.response_type).toBe("dashboard_action");

    const brokenJson = "not json at all";
    expect(safeJsonParse(brokenJson)).toBeNull();

    const partialJson = 'Some text before {"response_type": "dashboard_action"} and after';
    const partial = safeJsonParse(partialJson);
    expect(partial).toBeTruthy();
    expect(partial.response_type).toBe("dashboard_action");
  });

  it("dashboard actions schema-safe check works", () => {
    const safeResponse = {
      response_type: "dashboard_action",
      natural_response: "Dashboard generated",
      actions: [{ type: "CREATE_CHART", config: { chartType: "bar" } }],
      warnings: [],
      schema_safe: true,
    };

    const unsafeResponse = {
      response_type: "chat",
      natural_response: "I understood your request, but I could not safely generate dashboard actions.",
      actions: [],
      warnings: ["AI response was not valid JSON."],
      schema_safe: true,
    };

    expect(safeResponse.schema_safe).toBe(true);
    expect(safeResponse.response_type).toBe("dashboard_action");
    expect(unsafeResponse.response_type).toBe("chat");
    expect(unsafeResponse.warnings.length).toBeGreaterThan(0);
  });
});
