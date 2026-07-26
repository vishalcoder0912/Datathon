import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeReq, makeRes } from "./test-helpers.js";

const useIsolatedDataDir = () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "insightflow-test-"));
  process.env.DATA_DIR = dataDir;
  return dataDir;
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.DATA_DIR;
});

describe("canonical Node HTTP runtime", () => {
  it("returns a JSON error response for async route dispatch failures", async () => {
    vi.doMock("../routes/index.js", () => ({
      setupRoutes: vi.fn(async () => {
        throw new Error("async route failed");
      }),
    }));

    const { createHttpServer } = await import("../core/server.js");
    const server = createHttpServer();

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/test`);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe("Internal server error");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("dataset repository row identity", () => {
  it("patches a dataset row by exposed __rowId", async () => {
    useIsolatedDataDir();
    const { createDataset, patchDatasetRow } = await import(
      "../database/dataset-repository.js"
    );

    const dataset = createDataset({
      name: "Row Identity",
      columns: [{ name: "Name", type: "string" }],
      rows: [{ Name: "first" }, { Name: "second" }],
    });

    const targetRowId = dataset.rows[1].__rowId;
    const updated = patchDatasetRow({
      datasetId: dataset.id,
      rowId: targetRowId,
      column: "Name",
      value: "updated second",
    });

    expect(updated.rows[1]).toMatchObject({
      __rowId: targetRowId,
      Name: "updated second",
    });
    expect(updated.rows[0].Name).toBe("first");
  });
});

describe("/api/state hydration", () => {
  it("hydrates current dataset and chat history from persisted storage", async () => {
    useIsolatedDataDir();
    const { createDataset, saveChatMessage } = await import(
      "../database/dataset-repository.js"
    );
    const { handleStateRoutes, setState } = await import("../routes/state.js");

    const dataset = createDataset({
      name: "Persisted State",
      columns: [{ name: "Revenue", type: "number" }],
      rows: [{ Revenue: 100 }],
    });

    saveChatMessage(dataset.id, {
      id: "message-1",
      role: "user",
      content: "What is revenue?",
      timestamp: "2026-05-30T00:00:00.000Z",
    });

    setState({ dataset: null, chatMessages: [], analysis: { transient: true } });

    const response = makeRes();
    const handled = await handleStateRoutes(makeReq("GET"), response, "/api/state");
    const body = response.json();

    expect(handled).toBe(true);
    expect(body.data.dataset.id).toBe(dataset.id);
    expect(body.data.chatMessages).toHaveLength(1);
    expect(body.data.chatMessages[0]).toMatchObject({
      id: "message-1",
      content: "What is revenue?",
    });
    expect(body.data.analysis).toEqual({ transient: true });
  });
});
