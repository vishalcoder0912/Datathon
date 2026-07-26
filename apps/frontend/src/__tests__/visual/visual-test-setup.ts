import type { Page } from "@playwright/test";

export const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 2560, height: 1440 },
} as const;

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS;

export async function setViewport(page: Page, preset: ViewportPreset) {
  await page.setViewportSize(VIEWPORT_PRESETS[preset]);
}

export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean; mask?: string[] },
) {
  await page.screenshot({
    path: `__tests__/visual/screenshots/${name}.png`,
    fullPage: options?.fullPage ?? false,
  });
}

export async function toggleTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
  await page.waitForTimeout(300);
}

export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle" });
}

export function getComponentSelector(component: string): string {
  const map: Record<string, string> = {
    kpi: '[class*="rounded-xl"][class*="bg-card"]',
    chart: '[class*="recharts-wrapper"]',
    sidebar: "aside",
    filters: '[class*="rounded-xl"][class*="bg-card/50"]',
    map: '[class*="rsm-svg"]',
    chat: "form",
  };
  return map[component] || `[data-testid="${component}"]`;
}
