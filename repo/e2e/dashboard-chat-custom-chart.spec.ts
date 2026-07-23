import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("E2E Dashboard chat commands for custom charts", async ({ page }) => {
  await mockInsightFlowApi(page);

  // Overwrite dashboard-command mock for this test
  await page.route("**/api/datasets/*/dashboard-command", async (route) => {
    const body = route.request().postDataJSON() as { query?: string };
    const query = body.query?.toLowerCase() || "";

    if (query.includes("remove")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            action: "DELETE_CHART",
            message: "Chart Average Salary by Country removed.",
            schemaOnly: true
          }
        }
      });
    }

    if (query.includes("average salary")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            action: "GENERATE_CHART",
            message: "Chart Average Salary by Country created.",
            schemaOnly: true,
            chart: {
              id: "chart-salary",
              title: "Average Salary by Country",
              type: "bar",
              xKey: "country",
              yKey: "salary_usd",
              aggregation: "avg",
              data: [{ country: "India", salary_usd: 57500 }]
            }
          }
        }
      });
    }

    if (query.includes("pie chart")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            action: "GENERATE_CHART",
            message: "Pie chart of country created.",
            schemaOnly: true,
            chart: {
              id: "chart-pie",
              title: "Country Breakdown",
              type: "pie",
              xKey: "country",
              yKey: "count",
              aggregation: "count",
              data: [{ country: "India", count: 2 }]
            }
          }
        }
      });
    }

    return route.fulfill({ json: { success: true, data: {} } });
  });

  await gotoApp(page, "/dashboard");

  // Type: Show average salary_usd by country
  const chatInput = page.getByPlaceholder(/Ask:/i);
  await expect(chatInput).toBeVisible();
  await chatInput.fill("Show average salary_usd by country");
  await page.click("button[aria-label='Send dashboard command']");

  // Verify chart appears and chat response confirms creation
  await expect(page.getByText("Chart Average Salary by Country created.")).toBeVisible();

  // Type: Create pie chart of country
  await chatInput.fill("Create pie chart of country");
  await page.click("button[aria-label='Send dashboard command']");
  await expect(page.getByText("Pie chart of country created.")).toBeVisible();

  // Type: Remove Average Salary by Country
  await chatInput.fill("Remove Average Salary by Country");
  await page.click("button[aria-label='Send dashboard command']");
  await expect(page.getByText("Chart Average Salary by Country removed.")).toBeVisible();
});
