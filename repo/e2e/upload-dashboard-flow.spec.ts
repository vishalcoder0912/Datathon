import { expect, test } from "@playwright/test";
import path from "node:path";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("E2E Upload and dashboard generation flow", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/upload");

  // Perform upload
  await page.locator('input[type="file"]:not([multiple])').setInputFiles(path.resolve("sample.csv"));

  await gotoApp(page, "/dashboard");

  // Verify dataset details and KPI cards exist
  await expect(page.getByRole("heading", { name: /salary-small/i })).toBeVisible();
  await expect(page.getByText(/3 records|3 rows/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/Key Metrics|Total Records/i).first()).toBeVisible();
  
  // Verify average salary chart card renders
  await expect(page.getByText(/Average Salary by Country|Salary by Country/i).first()).toBeVisible();
});
