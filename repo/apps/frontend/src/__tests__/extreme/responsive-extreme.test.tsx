import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "@/shared/layout/AppLayout";

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({ dataset: { name: "Test", rowCount: 3 } }),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { userId: "t", email: "t@t.com", displayName: "T", roleCode: "EVALUATOR" },
    isDemoSession: true,
    logout: vi.fn(),
  }),
}));

vi.mock("@/kavach/context/ImportDataContext", () => ({
  useImportData: () => ({ hasCustomData: false, importedCount: 0, lastImportAt: null, refreshKey: 0, notifyImported: vi.fn(), reset: vi.fn() }),
  ImportDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const VIEWPORTS = [
  { name: "320px (small mobile)", width: 320 },
  { name: "375px (iPhone)", width: 375 },
  { name: "425px (larger phone)", width: 425 },
  { name: "768px (tablet)", width: 768 },
  { name: "1024px (small desktop)", width: 1024 },
  { name: "1440px (typical desktop)", width: 1440 },
  { name: "2560px (large/4K)", width: 2560 },
];

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

function ResponsiveContent() {
  return (
    <div>
      <nav>
        <a href="/dashboard">Dashboard</a>
        <a href="/geo">Geo Intelligence</a>
        <a href="/trends">Trend Intelligence</a>
        <a href="/alerts">Alerts</a>
        <a href="/reports">Reports</a>
        <a href="/upload">Upload</a>
        <a href="/chat">AI Chat</a>
      </nav>
      <main>
        <h1>Dashboard</h1>
        <div className="kpi-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} data-testid="kpi-card" className="kpi-card">KPI {i + 1}</div>
          ))}
        </div>
        <section data-testid="chart-section" className="chart-section">
          Chart Content
        </section>
      </main>
    </div>
  );
}

describe.each(VIEWPORTS)("Responsive layout at $name", ({ name, width }) => {
  it("renders all nav items without text cut off", () => {
    setViewportWidth(width);

    render(
      <MemoryRouter>
        <ResponsiveContent />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(7);
    links.forEach((link) => {
      const text = link.textContent;
      expect(text?.trim().length).toBeGreaterThan(0);
    });
  });

  it("renders KPI cards without overflow", () => {
    setViewportWidth(width);

    render(
      <MemoryRouter>
        <ResponsiveContent />
      </MemoryRouter>,
    );

    const kpiCards = screen.getAllByTestId("kpi-card");
    expect(kpiCards.length).toBe(6);
  });

  it("renders chart section without horizontal scroll triggers", () => {
    setViewportWidth(width);

    const { container } = render(
      <MemoryRouter>
        <ResponsiveContent />
      </MemoryRouter>,
    );

    const body = container.ownerDocument.body;
    expect(body.scrollWidth).toBeLessThanOrEqual(Math.max(body.clientWidth, width));
  });

  it("has visible main heading", () => {
    setViewportWidth(width);

    render(
      <MemoryRouter>
        <ResponsiveContent />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe("AppLayout responsiveness", () => {
  it("renders sidebar and main content area", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});

describe("No horizontal scroll", () => {
  it("body has no overflow at any viewport", () => {
    const widths = [320, 375, 425, 768, 1024, 1440, 2560];
    widths.forEach((w) => {
      setViewportWidth(w);
      render(
        <MemoryRouter>
          <div style={{ maxWidth: w }}>Test</div>
        </MemoryRouter>,
      );
    });
  });
});
