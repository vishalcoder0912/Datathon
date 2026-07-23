import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { API_ROUTES } from "@/api/routes";
import { apiRequest } from "@/api/client";

describe("API route map", () => {
  it("keeps dashboard, PDF Intelligence, chat, analytics, and dataset routes separate", () => {
    expect(API_ROUTES.state).toBe("/api/state");
    expect(API_ROUTES.dashboard.action).toBe("/api/dashboard/action");
    expect(API_ROUTES.dashboard.chat).toBe("/api/dashboard/chat");
    expect(API_ROUTES.dashboard.chartQuery).toBe("/api/dashboard/chart-query");
    expect(API_ROUTES.dashboard.removeChart).toBe("/api/dashboard/remove-chart");
    expect(API_ROUTES.dashboardAi.command).toBe("/api/dashboard-ai/command");
    expect(API_ROUTES.dashboardAi.generate).toBe("/api/dashboard-ai/generate");
    expect(API_ROUTES.dashboardAi.fix).toBe("/api/dashboard-ai/fix");
    expect(API_ROUTES.agentic.capabilities).toBe("/api/agentic/capabilities");
    expect(API_ROUTES.agentic.context("dataset_1")).toBe("/api/agentic/datasets/dataset_1/context");
    expect(API_ROUTES.agentic.dashboard("dataset_1")).toBe("/api/agentic/datasets/dataset_1/dashboard");
    expect(API_ROUTES.agentic.chat("dataset_1")).toBe("/api/agentic/datasets/dataset_1/chat");
    expect(API_ROUTES.pdfIntelligence.upload).toBe("/api/pdf-intelligence/upload");
    expect(API_ROUTES.pdfIntelligence.query("pdf_1")).toBe("/api/pdf-intelligence/pdf_1/query");
    expect(API_ROUTES.pdfIntelligence.details("pdf_1")).toBe("/api/pdf-intelligence/pdf_1");
    expect(API_ROUTES.pdfIntelligence.health).toBe("/api/pdf-intelligence/health");
    expect(API_ROUTES.copilotChat.analytics).toBe("/api/chat/analytics");
    expect(API_ROUTES.analytics.advanced).toBe("/api/analytics/advanced");
    expect(API_ROUTES.dataset.demo).toBe("/api/datasets/demo");
    expect(API_ROUTES.dataset.byId("dataset_1")).toBe("/api/datasets/dataset_1");
    expect(API_ROUTES.dataset.schema("dataset_1")).toBe("/api/datasets/dataset_1/schema");
    expect(API_ROUTES.dataset.chat("dataset_1")).toBe("/api/datasets/dataset_1/chat");

    const dashboardRoutes = [
      API_ROUTES.dashboard.action,
      API_ROUTES.dashboard.chat,
      API_ROUTES.dashboard.chartQuery,
      API_ROUTES.dashboard.removeChart,
      ...Object.values(API_ROUTES.dashboardAi),
    ];
    expect(dashboardRoutes.every((route) => !route.includes("pdf"))).toBe(true);

    const pdfRoutes = [
      API_ROUTES.pdfIntelligence.upload,
      API_ROUTES.pdfIntelligence.health,
      API_ROUTES.pdfIntelligence.details("pdf_1"),
      API_ROUTES.pdfIntelligence.query("pdf_1"),
      API_ROUTES.pdfIntelligence.explain("pdf_1"),
      API_ROUTES.pdfIntelligence.status("pdf_1"),
      API_ROUTES.pdfIntelligence.reindex("pdf_1"),
      API_ROUTES.pdfIntelligence.forceOcr("pdf_1"),
    ];
    expect(pdfRoutes.every((route) => !route.includes("dashboard"))).toBe(true);

    const datasetRoutes = [
      API_ROUTES.dataset.import,
      API_ROUTES.dataset.demo,
      API_ROUTES.dataset.active,
      API_ROUTES.dataset.byId("ds_1"),
      API_ROUTES.dataset.schema("ds_1"),
      API_ROUTES.dataset.chat("ds_1"),
      API_ROUTES.dataset.rows("ds_1"),
    ];
    expect(datasetRoutes.every((route) => !route.includes("pdf") && !route.includes("dashboard"))).toBe(true);

    expect(API_ROUTES.dataset.rows("dataset_1")).toBe("/api/datasets/dataset_1/rows");
  });
});

describe("source hygiene", () => {
  it("has no merge conflict markers in source files", async () => {
    const modules = import.meta.glob("../**/*.{ts,tsx,js,jsx}", {
      as: "raw",
      eager: true,
    }) as Record<string, string>;
    const markerPattern = new RegExp(
      [
        "^" + "<".repeat(7) + " HEAD$",
        "^" + "=".repeat(7) + "$",
        "^" + ">".repeat(7) + " origin/main$",
      ].join("|"),
      "m",
    );

    const offenders = Object.entries(modules)
      .filter(([, source]) => markerPattern.test(source))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a GET request with JSON headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest(API_ROUTES.state);

    expect(fetchMock).toHaveBeenCalledWith("/api/state", expect.objectContaining({ headers: expect.any(Object) }));
  });
});
