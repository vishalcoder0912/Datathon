import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SchemaDashboardChat from "@/features/dashboard/components/SchemaDashboardChat";
import { api } from "@/features/data/api/dataApi";

vi.mock("@/features/data/api/dataApi", () => ({
  api: {
    sendDashboardCommand: vi.fn(async () => ({
      action: "GENERATE_CHART",
      message: "Chart generated",
      schemaOnly: true,
      provider: "local-rules",
      chartSpec: {
        type: "bar",
        title: "Average Salary by Country",
        xKey: "country",
        yKey: "salary_usd",
        aggregation: "avg",
      },
    })),
  },
}));

const dataset = {
  rows: [
    { country: "India", salary_usd: 50000, experience: 2 },
    { country: "USA", salary_usd: 90000, experience: 5 },
  ],
  columns: ["country", "salary_usd", "experience"],
};

describe("SchemaDashboardChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders schema-only/provider badges and dynamic suggestions", () => {
    render(<SchemaDashboardChat dataset={dataset} onCommand={vi.fn()} />);

    expect(screen.getByText("Schema-only")).toBeInTheDocument();
    expect(screen.getByText(/Provider:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show average .* by .*/i })).toBeInTheDocument();
  });

  it("sends suggestion and manual input commands", async () => {
    const onCommand = vi.fn();
    const onSend = vi.fn();
    render(<SchemaDashboardChat dataset={dataset} onCommand={onCommand} onSend={onSend} />);

    fireEvent.click(screen.getByRole("button", { name: /Show average .* by .*/i }));
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith(expect.stringMatching(/salary/i));
    expect(screen.getByText(/Chart generated/)).toBeInTheDocument();
    expect(screen.getByText("Provider: local-rules")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ask/), {
      target: { value: "add KPI for highest salary_usd" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send dashboard command/i }));
    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(2));
  });

  it("shows a loading state while command is in flight", async () => {
    vi.mocked(api.sendDashboardCommand).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        action: "ANSWER",
        message: "Chart generated",
        schemaOnly: true,
        provider: "local-rules",
      } as any;
    });
    render(<SchemaDashboardChat dataset={dataset} onCommand={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Ask/), {
      target: { value: "show chart" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send dashboard command/i }));

    expect(document.querySelector(".animate-spin")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Chart generated/)).toBeInTheDocument());
  });
});
