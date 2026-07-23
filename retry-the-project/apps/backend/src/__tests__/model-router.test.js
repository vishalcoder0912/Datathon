import { describe, expect, it, afterEach, vi } from "vitest";
import { getModelForTask, isEmbeddingTask, isChatModel, isEmbeddingModel, getConfiguredModels, MODELS } from "../config/model-router.js";

describe("model-router", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns qwen3:8b for main_analyst", () => {
    expect(getModelForTask("main_analyst")).toBe("qwen3:8b");
  });

  it("returns qwen3:8b for dashboard_planner", () => {
    expect(getModelForTask("dashboard_planner")).toBe("qwen3:8b");
  });

  it("returns qwen3:8b for chatbot", () => {
    expect(getModelForTask("chatbot")).toBe("qwen3:8b");
  });

  it("returns qwen3:4b for kpi_validator", () => {
    expect(getModelForTask("kpi_validator")).toBe("qwen3:4b");
  });

  it("returns qwen3:4b for chart_validator", () => {
    expect(getModelForTask("chart_validator")).toBe("qwen3:4b");
  });

  it("returns qwen3:4b for json_validator", () => {
    expect(getModelForTask("json_validator")).toBe("qwen3:4b");
  });

  it("returns qwen3:4b for fact_checker", () => {
    expect(getModelForTask("fact_checker")).toBe("qwen3:4b");
  });

  it("returns qwen2.5-coder:7b for coding", () => {
    expect(getModelForTask("coding")).toBe("qwen2.5-coder:7b");
  });

  it("returns llama3.2:3b for fast", () => {
    expect(getModelForTask("fast")).toBe("llama3.2:3b");
  });

  it("returns nomic-embed-text for embedding", () => {
    expect(getModelForTask("embedding")).toBe("nomic-embed-text");
  });

  it("returns mainAnalyst model for unknown task", () => {
    expect(getModelForTask("unknown_task")).toBe(MODELS.mainAnalyst);
  });

  it("returns mainAnalyst model for null/undefined task", () => {
    expect(getModelForTask(null)).toBe(MODELS.mainAnalyst);
    expect(getModelForTask(undefined)).toBe(MODELS.mainAnalyst);
  });

  it("isEmbeddingTask returns true only for embedding", () => {
    expect(isEmbeddingTask("embedding")).toBe(true);
    expect(isEmbeddingTask("main_analyst")).toBe(false);
    expect(isEmbeddingTask("coding")).toBe(false);
  });

  it("isEmbeddingModel returns true only for nomic-embed-text", () => {
    expect(isEmbeddingModel("nomic-embed-text")).toBe(true);
    expect(isEmbeddingModel("nomic-embed-text:latest")).toBe(true);
    expect(isEmbeddingModel("qwen3:8b")).toBe(false);
    expect(isEmbeddingModel("llama3.2:3b")).toBe(false);
  });

  it("isChatModel returns true for chat models", () => {
    expect(isChatModel("qwen3:8b")).toBe(true);
    expect(isChatModel("qwen3:4b")).toBe(true);
    expect(isChatModel("llama3.2:3b")).toBe(true);
    expect(isChatModel("qwen2.5-coder:7b")).toBe(true);
  });

  it("nomic-embed-text is not classified as chat model", () => {
    expect(isChatModel("nomic-embed-text")).toBe(false);
    expect(isChatModel("nomic-embed-text:latest")).toBe(false);
  });

  it("getConfiguredModels returns all model mappings", () => {
    const models = getConfiguredModels();
    expect(models.main_analyst).toBe("qwen3:8b");
    expect(models.dashboard_planner).toBe("qwen3:8b");
    expect(models.chatbot).toBe("qwen3:8b");
    expect(models.kpi_validator).toBe("qwen3:4b");
    expect(models.chart_validator).toBe("qwen3:4b");
    expect(models.json_validator).toBe("qwen3:4b");
    expect(models.fact_checker).toBe("qwen3:4b");
    expect(models.coding).toBe("qwen2.5-coder:7b");
    expect(models.fast).toBe("llama3.2:3b");
    expect(models.embedding).toBe("nomic-embed-text");
  });

  it("fallback chain works: qwen3:8b -> qwen3:4b -> llama3.2:3b", () => {
    expect(getModelForTask("main_analyst")).toBe("qwen3:8b");
    expect(getModelForTask("kpi_validator")).toBe("qwen3:4b");
    expect(getModelForTask("fast")).toBe("llama3.2:3b");
  });

  it("nomic-embed-text is never returned for chat task types", () => {
    const chatTasks = ["main_analyst", "dashboard_planner", "chatbot", "kpi_validator", "chart_validator", "json_validator", "fact_checker", "coding", "fast", "quick_chat"];
    for (const task of chatTasks) {
      const model = getModelForTask(task);
      expect(model).not.toBe("nomic-embed-text");
      expect(isChatModel(model)).toBe(true);
    }
  });

  it("embedding task never returns a chat model", () => {
    const model = getModelForTask("embedding");
    expect(model).toBe("nomic-embed-text");
    expect(isEmbeddingModel(model)).toBe(true);
    expect(isChatModel(model)).toBe(false);
  });
});
