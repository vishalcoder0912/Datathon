import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "@/shared/layout/AppLayout";

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({
    dataset: { name: "Salary Small", rowCount: 3 },
  }),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      userId: "test-evaluator",
      email: "evaluator@kavach.local",
      displayName: "Synthetic Data Evaluator",
      roleCode: "EVALUATOR",
    },
    isDemoSession: true,
    logout: vi.fn(),
  }),
}));

vi.mock("@/kavach/context/ImportDataContext", () => ({
  useImportData: () => ({
    hasCustomData: false,
    importedCount: 0,
    lastImportAt: null,
    refreshKey: 0,
    notifyImported: vi.fn(),
    reset: vi.fn(),
  }),
  ImportDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("AppLayout", () => {
  it("renders the app shell with routed content", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(screen.getAllByText(/InsightFlow|Salary Small/).length).toBeGreaterThan(0);
  });
});
