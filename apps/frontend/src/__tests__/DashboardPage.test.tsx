import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({
    dataset: {
      id: "salary",
      name: "Salary Small",
      rowCount: 3,
      columns: [
        { name: "country", type: "string" },
        { name: "salary_usd", type: "number" },
        { name: "experience", type: "number" },
      ],
      rows: [
        { country: "India", salary_usd: 50000, experience: 2 },
        { country: "USA", salary_usd: 90000, experience: 5 },
        { country: "India", salary_usd: 65000, experience: 3 },
      ],
    },
    analysis: {
      dataTypeLabel: "Workforce salary",
      insights: [],
      chartRecommendations: [
        {
          title: "Average Salary by Country",
          type: "bar",
          xKey: "country",
          yKey: "salary_usd",
          aggregation: "avg",
          data: [],
        },
      ],
    },
    isHydrating: false,
    apiError: null,
    loadDemo: vi.fn(),
    resetAppState: vi.fn(),
    retryHydrate: vi.fn(),
  }),
}));

describe("DashboardPage integration", () => {
  it("renders dataset, KPI cards, chart cards, and assistant entry point", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("Salary Small")).toBeInTheDocument());
    expect(screen.getByText("Key Metrics")).toBeInTheDocument();
    expect(screen.getByText("Visualizations")).toBeInTheDocument();
    expect(screen.getByText("Average Salary by Country")).toBeInTheDocument();
    expect(document.querySelector(".fixed.bottom-6.right-6")).toBeTruthy();
  });
});
