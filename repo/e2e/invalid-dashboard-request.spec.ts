import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("E2E Invalid dashboard request safety", async ({ page }) => {
  await mockInsightFlowApi(page);

  // Overwrite dashboard-command to return a guardian validation failure response
  await page.route("**/api/datasets/*/dashboard-command", async (route) => {
    return route.fulfill({
      status: 400,
      json: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Column 'fake_column' does not exist in schema.",
          details: { column: "fake_column" }
        }
      }
    });
  });

  await gotoApp(page, "/dashboard");

  const chatInput = page.getByPlaceholder(/Ask:/i);
  await expect(chatInput).toBeVisible();

  await chatInput.fill("Show average fake_column by country");
  await page.click("button[aria-label='Send dashboard command']");

  // Verify warning message is shown
  await expect(page.getByText("Column 'fake_column' does not exist in schema.")).toBeVisible();
});
