import { expect, Page } from "@playwright/test";

export const salaryRows = [
  { country: "India", salary_usd: 50000, experience: 2 },
  { country: "USA", salary_usd: 90000, experience: 5 },
  { country: "India", salary_usd: 65000, experience: 3 },
];

export async function mockInsightFlowApi(page: Page) {
  const dataset = {
    id: "e2e-salary",
    name: "salary-small",
    rowCount: salaryRows.length,
    columns: [
      { name: "country", type: "string" },
      { name: "salary_usd", type: "number" },
      { name: "experience", type: "number" },
    ],
    rows: salaryRows,
  };

  const analysis = {
    dataTypeLabel: "Workforce salary",
    insights: [],
    chartRecommendations: [
      {
        id: "chart-country",
        title: "Average Salary by Country",
        type: "bar",
        xKey: "country",
        yKey: "salary_usd",
        aggregation: "avg",
        data: [
          { country: "India", salary_usd: 57500 },
          { country: "USA", salary_usd: 90000 },
        ],
      },
    ],
  };

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith("/api/")) return route.continue();
    const method = route.request().method();

    if (url.includes("/api/state")) {
      return route.fulfill({ json: { success: true, data: { dataset, chatMessages: [], analysis } } });
    }

    if (url.includes("/api/datasets/import") || url.includes("/api/datasets/merge") || url.includes("/api/datasets/demo")) {
      return route.fulfill({ json: { success: true, data: { dataset, chatMessages: [], analysis } } });
    }

    if (url.includes("/schema-dashboard") && method === "POST") {
      return route.fulfill({
        json: {
          success: true,
          data: {
            schemaOnly: true,
            profile: {
              datasetName: dataset.name,
              rowCount: dataset.rowCount,
              columnCount: dataset.columns.length,
              domain: "workforce_salary",
              columns: [
                { name: "country", type: "category", role: "location", uniqueCount: 2, topValues: ["India", "USA"] },
                { name: "salary_usd", type: "number", role: "money_metric", uniqueCount: 3 },
                { name: "experience", type: "number", role: "continuous_metric", uniqueCount: 3 },
              ],
            },
            memoryMatch: { dataset: "Salary Small", domain: "workforce_salary", score: 0.98 },
            dashboardPlan: {
              source: "e2e-mock",
              domain: "workforce_salary",
              kpis: [
                { title: "Total Records", metric: "__row_count__", aggregation: "count", format: "number" },
                { title: "Highest Salary", metric: "salary_usd", aggregation: "max", format: "currency" },
              ],
              charts: [
                { title: "Average Salary by Country", type: "bar", xKey: "country", yKey: "salary_usd", aggregation: "avg", limit: 10 },
              ],
              filters: [{ key: "country", label: "Country", type: "select" }],
            },
            model: "mock-schema-planner",
            provider: "mock",
          },
        },
      });
    }

    if (url.includes("/api/qr-upload/generate")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            sessionId: "session-1",
            uploadToken: "token", // audit-ignore: secret-leak
            uploadUrl: "http://127.0.0.1:5173/mobile-upload/session-1",
            qrDataUrl: "data:image/png;base64,abc",
            workspaceName: "InsightFlow Workspace",
            status: "waiting",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        },
      });
    }

    if (url.includes("/api/qr-upload/")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            sessionId: "session-1",
            status: "waiting",
            workspaceName: "InsightFlow Workspace",
            files: [],
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        },
      });
    }

    if (url.includes("/dashboard-command") && method === "POST") {
      const body = route.request().postDataJSON() as { query?: string };
      if (/highest/i.test(body.query || "")) {
        return route.fulfill({
          json: {
            success: true,
            data: {
              action: "GENERATE_KPI",
              message: "KPI generated",
              schemaOnly: true,
              kpiSpec: { title: "Highest Salary", metric: "salary_usd", aggregation: "max", format: "currency" },
            },
          },
        });
      }
      if (/clear/i.test(body.query || "")) {
        return route.fulfill({
          json: { success: true, data: { action: "CLEAR_FILTERS", message: "Filters cleared", schemaOnly: true } },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: {
            action: "GENERATE_CHART",
            message: "Chart generated",
            schemaOnly: true,
            chartSpec: {
              title: "Average Salary by Country",
              type: "bar",
              xKey: "country",
              yKey: "salary_usd",
              aggregation: "avg",
            },
          },
        },
      });
    }

    if (url.includes("/api/pdf/import")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            pdf: { id: "pdf-1", datasetId: dataset.id, fileName: "sample.pdf", jobId: "job-1", tableCount: 1, chunkCount: 1, textElementCount: 1 },
            dataset,
            analysis,
            knowledgeBaseSummary: { tableCount: 1, chunkCount: 1, textElementCount: 1 },
            privacy: { rawPdfSentToLLM: false, extractedTextCanBeUsedForRAG: true, dashboardValuesCalculatedLocally: true },
          },
        },
      });
    }

    if (url.includes("/api/pdf/pdf-1/ask")) {
      return route.fulfill({ json: { success: true, data: { answer: "North revenue is 1200.", sources: [] } } });
    }

    return route.fulfill({ json: { success: true, data: {} } });
  });
}

export async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main").first()).toBeVisible();
}