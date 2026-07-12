import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "@/shared/layout/AppLayout";

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({
    dataset: { name: "Salary Small", rowCount: 3 },
  }),
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
