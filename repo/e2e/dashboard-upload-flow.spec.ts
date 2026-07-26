import { expect, test } from "@playwright/test";
import path from "node:path";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("dashboard upload flow renders dataset, KPIs, charts, and assistant entry point", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/upload");

  await page.locator('input[type="file"]:not([multiple])').setInputFiles(path.resolve("tests/fixtures/salary-small.csv"));

  await gotoApp(page, "/dashboard");

  await expect(page.getByRole("heading", { name: /salary-small/i })).toBeVisible();
  await expect(page.getByText(/3 records|3 rows/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/Key Metrics|Total Records/i).first()).toBeVisible();
  await expect(page.getByText(/Average Salary by Country|Salary by Country/i).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByPlaceholder(/Ask:/i)).toBeVisible();
});
