import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const salesDataset = {
  id: "sales-123",
  name: "Sales Small",
  rowCount: 3,
  columns: [
    { name: "region", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" }
  ],
  rows: [
    { region: "North", category: "Office", revenue: 1000 },
    { region: "South", category: "Tech", revenue: 2000 },
    { region: "North", category: "Tech", revenue: 1500 }
  ]
};

const mockUseData = vi.fn();
vi.mock("@/features/data/context/useData", () => ({
  useData: () => mockUseData(),
}));

describe("DashboardAnalytics component schema alignment", () => {
  it("renders correctly from dataset schema", async () => {
    mockUseData.mockReturnValue({
      dataset: salesDataset,
      analysis: {
        dataTypeLabel: "Sales Dataset",
        insights: [],
        kpis: [
          { title: "Total Records", value: "3", icon: "rows", businessKpi: true },
          { title: "Total Revenue", value: "$4,500", icon: "chart", businessKpi: true }
        ],
        chartRecommendations: [
          {
            title: "Revenue by Region",
            type: "bar",
            xKey: "region",
            yKey: "revenue",
            aggregation: "sum",
            data: [
              { region: "North", revenue: 2500 },
              { region: "South", revenue: 2000 }
            ]
          }
        ]
      },
      isHydrating: false,
      apiError: null,
      loadDemo: vi.fn(),
      resetAppState: vi.fn(),
      retryHydrate: vi.fn()
    });

    render(<DashboardPage />);

    // Check dataset name is rendered
    expect(screen.getByText("Sales Small")).toBeInTheDocument();

    // Check KPIs are rendered
    expect(screen.getByText("Total Records")).toBeInTheDocument();
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();

    // Check chart titles are rendered
    expect(screen.getByText("Revenue by Region")).toBeInTheDocument();
  });
});
