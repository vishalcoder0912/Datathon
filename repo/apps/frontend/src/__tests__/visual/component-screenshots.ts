import { test, expect } from "@playwright/test";
import { VIEWPORT_PRESETS, setViewport, toggleTheme, takeScreenshot, navigateAndWait } from "./visual-test-setup";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

test.describe("Visual regression - light mode", () => {
  test.beforeEach(async ({ page }) => {
    await navigateAndWait(page, BASE_URL);
    await toggleTheme(page, "light");
  });

  test("mobile viewport @ 375px", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.waitForTimeout(500);
    await takeScreenshot(page, "dashboard-mobile-light", { fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("tablet viewport @ 768px", async ({ page }) => {
    await setViewport(page, "tablet");
    await page.waitForTimeout(500);
    await takeScreenshot(page, "dashboard-tablet-light", { fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("desktop viewport @ 1440px", async ({ page }) => {
    await setViewport(page, "desktop");
    await page.waitForTimeout(500);
    await takeScreenshot(page, "dashboard-desktop-light", { fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("wide viewport @ 2560px", async ({ page }) => {
    await setViewport(page, "wide");
    await page.waitForTimeout(500);
    await takeScreenshot(page, "dashboard-wide-light", { fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Visual regression - dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await navigateAndWait(page, BASE_URL);
    await toggleTheme(page, "dark");
  });

  test("desktop dark mode @ 1440px", async ({ page }) => {
    await setViewport(page, "desktop");
    await page.waitForTimeout(500);
    await takeScreenshot(page, "dashboard-desktop-dark", { fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("mobile dark mode @ 375px", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.waitForTimeout(500);
    await takeScreenshot(page, "dashboard-mobile-dark", { fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Visual regression - sidebar", () => {
  test("sidebar navigation on desktop", async ({ page }) => {
    await setViewport(page, "desktop");
    await navigateAndWait(page, BASE_URL);
    await page.waitForTimeout(500);

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    const navLinks = sidebar.locator("a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Visual regression - login page", () => {
  test("login form on desktop", async ({ page }) => {
    await setViewport(page, "desktop");
    await navigateAndWait(page, `${BASE_URL}/login`);
    await page.waitForTimeout(500);
    await takeScreenshot(page, "login-desktop", { fullPage: true });
  });
});
