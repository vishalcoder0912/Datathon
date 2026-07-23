import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("Analytics Page schema flow renders KPIs, correlation metrics, and anomaly detection charts", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/analytics");

  // Verify the advanced analytics heading is rendered
  await expect(page.getByRole("heading", { name: "Advanced Analytics" })).toBeVisible();

  // Verify advanced analytics KPI sections
  await expect(page.getByText("Correlations Found").first()).toBeVisible();
  await expect(page.getByText("Anomalies Detected").first()).toBeVisible();
  await expect(page.getByText("Strongest Driver").first()).toBeVisible();
  await expect(page.getByText("Forecast Confidence").first()).toBeVisible();

  // Verify the analytics page detects the dataset name 'salary-small'
  await expect(page.getByText(/salary-small/i).first()).toBeVisible();
});
