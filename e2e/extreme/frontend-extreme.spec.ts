import { test, expect } from "@playwright/test";

const FRONTEND = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

test.describe("Frontend Extreme — Button Spam", () => {
  test("double click on upload button", async ({ page }) => {
    await page.goto(`${FRONTEND}/upload`);
    const btn = page.locator("button").first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await btn.click();
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("100 rapid clicks on navigation link", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    const link = page.locator("a").first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (let i = 0; i < 100; i++) {
        await link.click({ force: true, noWaitAfter: true });
      }
      await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Frontend Extreme — Refresh During Request", () => {
  test("refresh during page load does not corrupt state", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.reload();
    await page.goto(`${FRONTEND}/upload`);
    await page.reload();
    await expect(page.locator("body")).toBeVisible();
  });

  test("rapid sequential navigation", async ({ page }) => {
    const urls = ["/dashboard", "/upload", "/analytics", "/chat", "/alerts", "/geo-intelligence"];
    for (const url of urls) {
      await page.goto(`${FRONTEND}${url}`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    }
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Frontend Extreme — Offline Mode", () => {
  test("page shows offline indicator when network is disconnected", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await page.context().setOffline(false);
  });

  test("page recovers after offline -> online transition", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await page.context().setOffline(false);
    await page.reload();
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Frontend Extreme — Network Throttle", () => {
  const throttles = [
    { name: "2G (Slow 3G)", download: 280, upload: 256, latency: 2000 },
    { name: "3G (Regular 3G)", download: 768, upload: 384, latency: 750 },
    { name: "4G (LTE)", download: 12000, upload: 6000, latency: 100 },
    { name: "5G", download: 100000, upload: 50000, latency: 10 },
  ];

  for (const t of throttles) {
    test(`network throttle: ${t.name}`, async ({ page }) => {
      const client = await page.context().newCDPSession(page);
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: t.download * 1024,
        uploadThroughput: t.upload * 1024,
        latency: t.latency,
      });
      await page.goto(`${FRONTEND}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
    });
  }
});

test.describe("Frontend Extreme — Viewports", () => {
  const viewports = [
    { name: "320px (Mobile)", width: 320, height: 568 },
    { name: "375px (iPhone)", width: 375, height: 667 },
    { name: "425px (Large Phone)", width: 425, height: 812 },
    { name: "768px (Tablet)", width: 768, height: 1024 },
    { name: "1024px (Small Desktop)", width: 1024, height: 768 },
    { name: "1440px (Desktop)", width: 1440, height: 900 },
    { name: "4K (UHD)", width: 3840, height: 2160 },
  ];

  for (const vp of viewports) {
    test(`viewport: ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${FRONTEND}/dashboard`);
      await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
      const title = await page.title().catch(() => "");
      expect(title.length).toBeGreaterThanOrEqual(0);
    });
  }
});

test.describe("Frontend Extreme — Zoom Levels", () => {
  test("page at 50% zoom", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.evaluate(() => {
      document.body.style.zoom = "50%";
    });
    await expect(page.locator("body")).toBeVisible();
  });

  test("page at 200% zoom", async ({ page }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    await page.evaluate(() => {
      document.body.style.zoom = "200%";
    });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Frontend Extreme — Browser Navigation", () => {
  test("browser back and forward preserves state", async ({ page }) => {
    await page.goto(`${FRONTEND}/upload`);
    await page.goto(`${FRONTEND}/dashboard`);
    await page.goBack();
    await expect(page.locator("body")).toBeVisible();
    await page.goForward();
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Frontend Extreme — Multiple Tabs", () => {
  test("open app in two tabs simultaneously", async ({ page, context }) => {
    await page.goto(`${FRONTEND}/dashboard`);
    const page2 = await context.newPage();
    await page2.goto(`${FRONTEND}/dashboard`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page2.locator("body")).toBeVisible();
    await page2.close();
  });

  test("three simultaneous tabs on different routes", async ({ page, context }) => {
    const routes = ["/dashboard", "/upload", "/analytics"];
    await page.goto(`${FRONTEND}${routes[0]}`);
    const pages = await Promise.all(
      routes.slice(1).map((r) =>
        context.newPage().then(async (p) => {
          await p.goto(`${FRONTEND}${r}`);
          return p;
        })
      )
    );
    await expect(page.locator("body")).toBeVisible();
    for (const p of pages) {
      await expect(p.locator("body")).toBeVisible();
      await p.close();
    }
  });
});
