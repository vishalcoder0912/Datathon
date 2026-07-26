import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PremiumAgenticDashboardPage from "@/features/dashboard/pages/PremiumAgenticDashboardPage";

const loadDemo = vi.fn();

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({
    dataset: null,
    deleteDataset: vi.fn(),
    isHydrating: false,
    loadDemo,
  }),
}));

vi.mock("@/features/dashboard/hooks/usePremiumAgenticDashboard", () => ({
  usePremiumAgenticDashboard: () => ({
    dashboard: null,
    messages: [],
    loading: false,
    error: null,
    deepResearch: false,
    setDeepResearch: vi.fn(),
    runPrompt: vi.fn(),
  }),
}));

describe("PremiumAgenticDashboardPage empty state", () => {
  it("shows upload and demo actions instead of a blank page", () => {
    render(
      <MemoryRouter>
        <PremiumAgenticDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /no dataset loaded/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload dataset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load demo/i })).toBeInTheDocument();
    expect(screen.getByText(/market,revenue/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load demo/i }));
    expect(loadDemo).toHaveBeenCalledTimes(1);
  });
});
