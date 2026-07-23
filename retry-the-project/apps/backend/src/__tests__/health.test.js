import { describe, expect, it } from "vitest";
import { handleHealthRoutes } from "../routes/health.js";
import { handleAgenticApiRoutes } from "../routes/agentic-api.js";
import { handleAIRoutes } from "../routes/ai.js";
import { makeReq, makeRes } from "./test-helpers.js";

describe("health API", () => {
  it("GET /api/health returns healthy", async () => {
    const response = makeRes();
    const handled = await handleHealthRoutes(makeReq("GET"), response, "/api/health");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("healthy");
  });

  it("GET /api/agentic/health returns healthy", async () => {
    const response = makeRes();
    const handled = await handleAgenticApiRoutes(makeReq("GET"), response, "/api/agentic/health");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("healthy");
  });

  it("GET /api/ai/providers/health returns active status", async () => {
    const response = makeRes();
    const handled = await handleAIRoutes(makeReq("GET"), response, "/api/ai/providers/health");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.providers).toBeDefined();
  });
});
