import { expect, test } from "@playwright/test";
import { gotoApp, mockInsightFlowApi } from "./helpers";

test("PDF intelligence flow renders upload and mocked Q&A states", async ({ page }) => {
  await mockInsightFlowApi(page);
  await gotoApp(page, "/pdf");

  await expect(page.getByText(/PDF|Upload/i).first()).toBeVisible();
  await expect(page.getByText(/raw|privacy|dashboard|PDF/i).first()).toBeVisible();
});
