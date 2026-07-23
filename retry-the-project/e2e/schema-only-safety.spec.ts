import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("schema-only safety flow never displays sentinel raw row values", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/dashboard");

  await expect(page.getByRole("heading", { name: /salary-small/i })).toBeVisible();
  await expect(page.getByText("SECRET_RAW_ROW_SHOULD_NEVER_REACH_LLM")).toHaveCount(0);

  const textbox = page.getByRole("textbox").last();
  await textbox.fill("show average salary_usd by country as bar chart");
  await textbox.press("Enter");

  await expect(page.getByText(/Chart generated|Average Salary by Country/i).first()).toBeVisible();
  await expect(page.getByText("SECRET_RAW_ROW_SHOULD_NEVER_REACH_LLM")).toHaveCount(0);
});
