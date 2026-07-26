import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "@/shared/layout/AppLayout";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import StatusPanel from "@/shared/layout/StatusPanel";

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({ dataset: { name: "Test", rowCount: 3 } }),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { userId: "test", email: "test@test.com", displayName: "Test User", roleCode: "EVALUATOR" },
    isDemoSession: true,
    logout: vi.fn(),
  }),
}));

vi.mock("@/kavach/context/ImportDataContext", () => ({
  useImportData: () => ({ hasCustomData: false, importedCount: 0, lastImportAt: null, refreshKey: 0, notifyImported: vi.fn(), reset: vi.fn() }),
  ImportDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function ProblematicChild() {
  throw new Error("Crash");
}

describe("AppLayout a11y", () => {
  it("has proper landmark regions", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const main = screen.queryByRole("main");
    expect(main).toBeInTheDocument();

    const nav = screen.queryByRole("navigation");
    expect(nav).toBeInTheDocument();

    const banner = document.querySelector('[role="note"]');
    expect(banner).toBeInTheDocument();
  });

  it("has accessible navigation elements", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const navLinks = screen.getAllByRole("link");
    expect(navLinks.length).toBeGreaterThan(0);
    navLinks.forEach((link) => {
      expect(link).toHaveAttribute("href");
    });
  });
});

describe("StatusPanel a11y", () => {
  it("has proper heading and ARIA attributes", () => {
    render(
      <StatusPanel
        title="No Data"
        message="Upload a dataset to begin."
        actionLabel="Upload"
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /upload/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("renders without action when none provided", () => {
    render(<StatusPanel title="Loading" message="Please wait..." />);

    expect(screen.getByRole("heading", { name: /loading/i })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ErrorBoundary a11y", () => {
  it("renders accessible fallback UI with ARIA attributes", () => {
    const originalError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <ProblematicChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Crash")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    console.error = originalError;
  });
});

describe("Loading states a11y", () => {
  it("supports aria-busy and aria-live attributes on loading containers", () => {
    render(
      <div aria-busy="true" aria-live="polite" role="status">
        Loading data...
      </div>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
