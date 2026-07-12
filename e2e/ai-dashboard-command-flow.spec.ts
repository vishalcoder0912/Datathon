import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("AI dashboard command flow supports chart, KPI, and clear filters commands", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/dashboard");

  await expect(page.getByRole("heading", { name: /salary-small/i })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByPlaceholder(/Ask:/i)).toBeVisible();

  const textbox = page.getByRole("textbox").last();
  await textbox.fill("show average salary_usd by country as bar chart");
  await textbox.press("Enter");
  await expect(page.getByText(/Average Salary by Country|Chart generated/i).first()).toBeVisible();

  await textbox.fill("add KPI for highest salary_usd");
  await textbox.press("Enter");
  await expect(page.getByText(/Highest Salary|KPI generated/i).first()).toBeVisible();

  await textbox.fill("clear filters");
  await textbox.press("Enter");
  await expect(page.getByText(/Filters cleared|clear filters/i).first()).toBeVisible();
});
