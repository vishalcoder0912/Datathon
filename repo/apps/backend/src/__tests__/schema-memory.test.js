import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeReq, makeRes, salaryDataset } from "./test-helpers.js";

describe("schema training memory routes", () => {
  let originalCwd;
  let tempDir;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "insightflow-memory-"));
    process.chdir(tempDir);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("loads, trains, and matches similar schema memory", async () => {
    const { handleSchemaTrainedAIRoutes } = await import("../routes/schema-trained-ai.routes.js");

    const getResponse = makeRes();
    await handleSchemaTrainedAIRoutes(makeReq("GET"), getResponse, "/api/ai/schema-training-memory");
    expect(getResponse.json().success).toBe(true);

    const trainResponse = makeRes();
    await handleSchemaTrainedAIRoutes(makeReq("POST", {
      ...salaryDataset,
      dashboardPlan: {
        kpis: [{ title: "Total Records", metric: "__row_count__", aggregation: "count" }],
        charts: [{ title: "Average Salary by Country", type: "bar", xKey: "country", yKey: "salary_usd", aggregation: "avg" }],
      },
    }), trainResponse, "/api/datasets/test-local/schema-train");
    expect(trainResponse.json().data.stats.count).toBeGreaterThanOrEqual(1);

    const dashboardResponse = makeRes();
    await handleSchemaTrainedAIRoutes(makeReq("POST", {
      ...salaryDataset,
      rows: salaryDataset.rows.map((row) => ({ ...row })),
      useLlm: false,
      threshold: 0.1,
    }), dashboardResponse, "/api/datasets/test-local/schema-dashboard");

    const payload = dashboardResponse.json();
    expect(payload.data.match).toBeTruthy();
    expect(payload.data.match.score).toBeGreaterThan(0.1);
  });
});
