import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";

const chart = {
  id: "chart-1",
  title: "Average Salary by Country",
  type: "bar" as const,
  xKey: "country",
  yKey: "value",
  aggregation: "avg" as const,
  data: [
    { country: "India", value: 57500 },
    { country: "USA", value: 90000 },
  ],
};

describe("SmartChartCard", () => {
  it("renders chart metadata and supports type changes", () => {
    const onTypeChange = vi.fn();
    render(<SmartChartCard chart={chart} onTypeChange={onTypeChange} onRemove={vi.fn()} onDuplicate={vi.fn()} />);

    expect(screen.getByText("Average Salary by Country")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "line" } });
    expect(onTypeChange).toHaveBeenCalledWith("line");
  });

  it("renders the empty chart state", () => {
    render(<SmartChartCard chart={{ ...chart, data: [] }} />);
    expect(screen.getByText(/Not enough data/)).toBeInTheDocument();
  });
});
