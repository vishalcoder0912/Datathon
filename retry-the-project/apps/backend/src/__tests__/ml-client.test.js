import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import MLClient, {
  analyticsCacheSize,
  clearAnalyticsCache,
  fingerprintDataset,
  sampleRows,
} from "../services/ml-client.js";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const dataset = {
  id: "sales",
  columns: [{ name: "region" }, { name: "revenue" }],
  rows: [
    { region: "North", revenue: 100 },
    { region: "South", revenue: 200 },
  ],
};

describe("MLClient", () => {
  beforeEach(() => {
    clearAnalyticsCache();
    vi.clearAllMocks();
  });

  it("builds a stable dataset fingerprint from columns, row count, schema, and sample hash", () => {
    expect(fingerprintDataset(dataset)).toBe(fingerprintDataset({ ...dataset }));
    expect(fingerprintDataset({ ...dataset, rows: [...dataset.rows, { region: "West", revenue: 300 }] }))
      .not.toBe(fingerprintDataset(dataset));
  });

  it("samples large datasets before sending them to Python", () => {
    const rows = Array.from({ length: 60_000 }, (_, index) => ({ index }));
    const sampled = sampleRows(rows, 1_000);

    expect(sampled).toHaveLength(1_000);
    expect(sampled[0]).toEqual({ index: 0 });
    expect(sampled.at(-1).index).toBeLessThan(60_000);
  });

  it("caches repeated analytics calls for the same dataset fingerprint", async () => {
    axios.post.mockResolvedValue({ data: { rowCount: 2, columnCount: 2 } });

    const first = await MLClient.profile(dataset);
    const second = await MLClient.profile(dataset);

    expect(first.source).toBe("python");
    expect(second.source).toBe("node-cache");
    expect(second.cacheHit).toBe(true);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(analyticsCacheSize()).toBe(1);
  });

  it("returns JavaScript fallback results when Python is unavailable", async () => {
    axios.post.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await MLClient.profile(dataset, () => ({
      rowCount: dataset.rows.length,
      columnCount: dataset.columns.length,
    }));

    expect(result.success).toBe(true);
    expect(result.source).toBe("javascript-fallback");
    expect(result.rowCount).toBe(2);
    expect(result.fallbackReason).toContain("ECONNREFUSED");
  });
});
