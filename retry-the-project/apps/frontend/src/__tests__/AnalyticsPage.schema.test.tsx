import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "@/features/analytics/pages/AnalyticsPage";

// Mock useNavigate
const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const mockUseData = vi.fn();
vi.mock("@/features/data/context/useData", () => ({
  useData: () => mockUseData(),
}));

const salesDataset = {
  id: "sales-id",
  name: "Sales Dataset",
  columns: [
    { name: "order_id", type: "string" },
    { name: "region", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" },
    { name: "profit", type: "number" }
  ],
  rows: [
    { order_id: "ORD01", region: "North", category: "Tech", revenue: 1000, profit: 200 },
    { order_id: "ORD02", region: "South", category: "Office", revenue: 500, profit: 100 }
  ]
};

const salaryDataset = {
  id: "salary-id",
  name: "Salary Dataset",
  columns: [
    { name: "job_title", type: "string" },
    { name: "country", type: "string" },
    { name: "salary_usd", type: "number" }
  ],
  rows: [
    { job_title: "Data Scientist", country: "India", salary_usd: 80000 },
    { job_title: "ML Engineer", country: "USA", salary_usd: 120000 }
  ]
};

describe("AnalyticsPage schema-aware checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no dataset is loaded", () => {
    mockUseData.mockReturnValue({
      dataset: null,
      isHydrating: false,
      apiError: null,
      loadDemo: vi.fn(),
      retryHydrate: vi.fn(),
    });

    render(<AnalyticsPage />);
    expect(screen.getByText(/No dataset loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload a dataset before running advanced analytics/i)).toBeInTheDocument();
  });

  it("renders correct metrics and summary cards for sales dataset", () => {
    mockUseData.mockReturnValue({
      dataset: salesDataset,
      isHydrating: false,
      apiError: null,
      loadDemo: vi.fn(),
      retryHydrate: vi.fn(),
    });

    render(<AnalyticsPage />);

    expect(screen.getByRole("heading", { name: /^Advanced Analytics$/i })).toBeInTheDocument();
    // It should render summary headers
    expect(screen.getByText("Correlations Found")).toBeInTheDocument();
    expect(screen.getByText("Anomalies Detected")).toBeInTheDocument();
    expect(screen.getByText("Strongest Driver")).toBeInTheDocument();
    
    // Ensure no salary KPIs appear in sales dataset
    expect(screen.queryByText(/Average Salary/i)).not.toBeInTheDocument();
  });

  it("renders correct metrics and filters for salary dataset", () => {
    mockUseData.mockReturnValue({
      dataset: salaryDataset,
      isHydrating: false,
      apiError: null,
      loadDemo: vi.fn(),
      retryHydrate: vi.fn(),
    });

    render(<AnalyticsPage />);

    expect(screen.getByRole("heading", { name: /^Advanced Analytics$/i })).toBeInTheDocument();
    // Verify the metric option matches salary_usd
    expect(screen.getAllByText("salary_usd").length).toBeGreaterThan(0);
  });
});
