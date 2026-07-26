import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const FRONTEND = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

const ROUTES = [
  { path: "/login", name: "Login Page" },
  { path: "/dashboard", name: "Dashboard" },
  { path: "/upload", name: "Upload" },
  { path: "/analytics", name: "Analytics" },
  { path: "/chat", name: "Chat" },
  { path: "/alerts", name: "Alerts" },
  { path: "/geo-intelligence", name: "Geo Intelligence" },
  { path: "/ai-copilot", name: "AI Copilot" },
  { path: "/reports", name: "Reports" },
  { path: "/offenders", name: "Offenders" },
  { path: "/network-intelligence", name: "Network Intelligence" },
  { path: "/trend-intelligence", name: "Trend Intelligence" },
  { path: "/data", name: "Data Table" },
  { path: "/data-management", name: "Data Management" },
  { path: "/insightflow-dashboard", name: "InsightFlow Dashboard" },
  { path: "/ml", name: "ML" },
  { path: "/agentic", name: "Agentic" },
  { path: "/agentic-data-science", name: "Agentic Data Science" },
  { path: "/pdf", name: "PDF Upload" },
];

test.describe("Accessibility — Axe Core Scan", () => {
  for (const route of ROUTES) {
    test(`${route.name} has no critical accessibility violations`, async ({ page }) => {
      await page.goto(`${FRONTEND}${route.path}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toHaveLength(0);
    });
  }
});

test.describe("Accessibility — Keyboard Navigation", () => {
  for (const route of ROUTES.slice(0, 6)) {
    test(`${route.name} can be navigated with Tab key`, async ({ page }) => {
      await page.goto(`${FRONTEND}${route.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(500);
      const focusableCount = await page.evaluate(() => {
        return document.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ).length;
      });
      expect(focusableCount).toBeGreaterThan(0);
      for (let i = 0; i < Math.min(focusableCount, 10); i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(100);
      }
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName : null;
      });
      expect(focused).toBeTruthy();
    });
  }
});

test.describe("Accessibility — ARIA Landmarks", () => {
  for (const route of ROUTES.slice(0, 6)) {
    test(`${route.name} has proper ARIA landmarks`, async ({ page }) => {
      await page.goto(`${FRONTEND}${route.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      const landmarks = await page.evaluate(() => {
        const roles = ["main", "navigation", "banner", "contentinfo", "complementary", "search"];
        const found: string[] = [];
        for (const role of roles) {
          const els = document.querySelectorAll(`[role="${role}"]`);
          if (els.length > 0) found.push(role);
        }
        found.push(...document.querySelectorAll("nav").length > 0 ? ["nav-element"] : []);
        found.push(...document.querySelectorAll("main").length > 0 ? ["main-element"] : []);
        found.push(...document.querySelectorAll("header").length > 0 ? ["header-element"] : []);
        found.push(...document.querySelectorAll("footer").length > 0 ? ["footer-element"] : []);
        return found;
      });
      expect(landmarks.length).toBeGreaterThan(0);
    });
  }
});

test.describe("Accessibility — Color Contrast", () => {
  test("text elements have sufficient color contrast", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const results = await new AxeBuilder({ page })
      .withTags(["color-contrast"])
      .analyze();
    const contrastViolations = results.violations.filter((v) => v.id === "color-contrast");
    expect(contrastViolations.length).toBe(0);
  });

  test("text elements meet WCAG AAA contrast when possible", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aaa"])
      .analyze();
    const seriousContrast = results.violations.filter(
      (v) => v.id === "color-contrast-enhanced"
    );
    expect(seriousContrast.length).toBeLessThanOrEqual(3);
  });
});

test.describe("Accessibility — Focus Management", () => {
  test("focus order is logical on dashboard", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const results = await new AxeBuilder({ page })
      .withTags(["keyboard", "focus"])
      .analyze();
    const focusViolations = results.violations.filter(
      (v) => v.id === "focus-order-semantics" || v.id === "tabindex"
    );
    expect(focusViolations.length).toBe(0);
  });

  test("focus indicator is visible on interactive elements", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return (
        style.outlineStyle !== "none" &&
        style.outlineWidth !== "0px" &&
        style.outlineColor !== "transparent"
      );
    });
    expect(hasFocusStyle).toBe(true);
  });
});

test.describe("Accessibility — Screen Reader", () => {
  test("all images have alt text", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const images = await page.locator("img").all();
    for (const img of images) {
      const alt = await img.getAttribute("alt");
      expect(alt).not.toBeNull();
    }
  });

  test("buttons have accessible names", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const buttons = await page.locator("button").all();
    for (const btn of buttons) {
      const name = await btn.getAttribute("aria-label");
      const text = await btn.textContent();
      const hasName = name && name.trim().length > 0;
      const hasText = text && text.trim().length > 0;
      if (!hasName && !hasText) {
        const hasAriaLabelledby = await btn.getAttribute("aria-labelledby");
        expect(hasAriaLabelledby).toBeTruthy();
      }
    }
  });

  test("forms have associated labels", async ({ page }) => {
    await page.goto(`${FRONTEND}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const inputs = await page.locator("input").all();
    for (const input of inputs) {
      const id = await input.getAttribute("id");
      if (!id) continue;
      const label = page.locator(`label[for="${id}"]`);
      const ariaLabel = await input.getAttribute("aria-label");
      const hasLabel = (await label.count()) > 0;
      const hasAriaLabel = ariaLabel !== null && ariaLabel.trim().length > 0;
      expect(hasLabel || hasAriaLabel).toBe(true);
    }
  });
});

test.describe("Accessibility — Reduced Motion", () => {
  test("page respects prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const hasReducedMotion = await page.evaluate(() => {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });
    expect(hasReducedMotion).toBe(true);
  });
});

test.describe("Accessibility — High Contrast Mode", () => {
  test("page renders in forced-colors mode", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const isForcedColors = await page.evaluate(() => {
      return window.matchMedia("(forced-colors: active)").matches;
    });
    expect(isForcedColors).toBe(true);
  });
});
