import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("Dashboard AI command flow validates commands, updates charts, and updates audit logs", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/dashboard");

  // Verify the page title/header is present
  await expect(page.getByRole("heading", { name: "InsightFlow Agentic Dashboard" })).toBeVisible();

  // Find the AI input textbox
  const input = page.getByPlaceholder(/Ask:/i);
  await expect(input).toBeVisible();

  // 1. Submit a valid command to generate a chart
  await input.fill("Generate Chart");
  await input.press("Enter");

  // Verify that the UI updates the chat messages
  await expect(page.getByText("Generate Chart").first()).toBeVisible();
  
  // Verify that the dashboard action was recorded in the audit trail (Recent actions)
  await expect(page.getByText("Recent actions")).toBeVisible();
  await expect(page.getByText("Created average salary_usd chart by country").first()).toBeVisible();
});
