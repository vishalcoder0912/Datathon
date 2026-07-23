import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("Geo Intelligence Flow displays the geo card with locations for geo datasets and shows fallback text for non-geo datasets", async ({ page }) => {
  // 1. Test WITH geo dimensions (default mock contains 'country')
  await mockInsightFlowApi(page);
  await gotoApp(page, "/dashboard");

  // Verify that Geo Intelligence card renders and displays locations
  await expect(page.getByText("Geo Intelligence").first()).toBeVisible();
  await expect(page.getByText("Top Locations").first()).toBeVisible();
  await expect(page.getByText("India").first()).toBeVisible();

  // 2. Test WITHOUT geo dimensions
  await page.route("**/api/state", async (route) => {
    return route.fulfill({
      json: {
        success: true,
        data: {
          dataset: {
            id: "e2e-no-geo",
            name: "sales-no-geo",
            rowCount: 2,
            columns: [
              { name: "order_id", type: "string" },
              { name: "revenue", type: "number" },
            ],
            rows: [
              { order_id: "1", revenue: 100 },
              { order_id: "2", revenue: 200 },
            ],
          },
          chatMessages: [],
          analysis: {
            dataTypeLabel: "Sales",
            insights: [],
            chartRecommendations: [],
          },
        },
      },
    });
  });

  // Reload the page to load the new state
  await page.reload();

  // Verify that the Geo Intelligence card displays the fallback text when no geo field is detected
  await expect(page.getByText("No geographic field detected in this dataset.").first()).toBeVisible();
});
