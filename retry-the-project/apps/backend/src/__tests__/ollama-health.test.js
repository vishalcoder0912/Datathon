import { describe, expect, it, afterEach, vi } from "vitest";
import { handleAIRoutes } from "../routes/ai.js";
import { getOllamaStatus } from "../services/ollama/ollama-dual-model-service.js";

function makeReq(method, body = {}) {
  return {
    method,
    body,
    readable: false,
    headers: { "content-type": "application/json" },
  };
}

function makeRes() {
  const response = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      for (const [key, value] of Object.entries(headers)) this.setHeader(key, value);
    },
    end(chunk = "") {
      this.body += String(chunk);
    },
    json() {
      return JSON.parse(this.body || "{}");
    },
  };
  return response;
}

describe("Ollama health endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/ai/ollama/health returns status", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.includes("/api/tags")) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { name: "qwen3:8b" },
              { name: "qwen3:4b" },
              { name: "qwen2.5-coder:7b" },
              { name: "llama3.2:3b" },
              { name: "nomic-embed-text" },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }));

    const response = makeRes();
    const handled = await handleAIRoutes(makeReq("GET"), response, "/api/ai/ollama/health");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);

    const data = response.json();
    expect(data.ollama_running).toBe(true);
    expect(data.success).toBe(true);
    expect(data.models["qwen3:8b"]).toBe(true);
    expect(data.models["qwen3:4b"]).toBe(true);
    expect(data.models["qwen2.5-coder:7b"]).toBe(true);
    expect(data.models["llama3.2:3b"]).toBe(true);
    expect(data.models["nomic-embed-text"]).toBe(true);
    expect(data.configured_models.main_analyst).toBe("qwen3:8b");
    expect(data.configured_models.embedding).toBe("nomic-embed-text");
  });

  it("GET /api/ai/ollama/health reports missing models", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.includes("/api/tags")) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: "qwen3:8b" }, { name: "llama3.2:3b" }],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }));

    const response = makeRes();
    const handled = await handleAIRoutes(makeReq("GET"), response, "/api/ai/ollama/health");
    expect(handled).toBe(true);

    const data = response.json();
    expect(data.ollama_running).toBe(true);
    expect(data.success).toBe(false);
    expect(data.models["qwen3:8b"]).toBe(true);
    expect(data.models["qwen3:4b"]).toBe(false);
    expect(data.missing_models).toContain("qwen3:4b");
    expect(data.missing_models).toContain("qwen2.5-coder:7b");
    expect(data.missing_models).toContain("nomic-embed-text");
    expect(data.install_commands.length).toBeGreaterThan(0);
    expect(data.install_commands[0]).toMatch(/^ollama pull/);
  });

  it("GET /api/ai/ollama/health handles Ollama offline gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Ollama not running");
    }));

    const response = makeRes();
    const handled = await handleAIRoutes(makeReq("GET"), response, "/api/ai/ollama/health");
    expect(handled).toBe(true);

    const data = response.json();
    expect(data.ollama_running).toBe(false);
    expect(data.success).toBe(false);
    expect(data.models).toEqual({});
    expect(data.configured_models).toBeDefined();
    expect(data.install_commands.length).toBeGreaterThan(0);
  });

  it("getOllamaStatus returns running=false when Ollama is offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Connection refused");
    }));

    const status = await getOllamaStatus();
    expect(status.running).toBe(false);
    expect(status.models).toEqual([]);
    expect(status.dashboardModel).toBeTruthy();
  });

  it("GET /api/ai/ollama-status still works (backward compat)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          models: [{ name: "qwen3:8b" }],
        }),
      };
    }));

    const response = makeRes();
    const handled = await handleAIRoutes(makeReq("GET"), response, "/api/ai/ollama-status");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);

    const data = response.json();
    expect(data.success).toBe(true);
    expect(data.data.ollama.running).toBe(true);
  });
});
