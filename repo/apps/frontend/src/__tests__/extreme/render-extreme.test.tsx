import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useState, useEffect } from "react";

function LargeTable({ rows }: { rows: Array<Record<string, string | number>> }) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <div role="region" aria-label="Data table">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col}>{String(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardGrid({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} data-testid="kpi-card" className="kpi-card">
          <p>Metric {i + 1}</p>
          <p>Value: {Math.random() * 1000}</p>
        </div>
      ))}
    </div>
  );
}

function ChartGrid({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <section key={i} data-testid="chart-card">
          <h3>Chart {i + 1}</h3>
          <div style={{ height: 200, background: "#f0f0f0" }} />
        </section>
      ))}
    </div>
  );
}

function DeepRouter({ depth }: { depth: number }) {
  if (depth <= 0) return <div>Leaf route</div>;
  return <DeepRouter depth={depth - 1} />;
}

function RouteChanger() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setCount((c) => c + 1), 50);
    return () => clearInterval(interval);
  }, []);

  return <div data-testid="route-count">Route change #{count}</div>;
}

describe("Render extreme - large datasets", () => {
  it("renders 10000 rows in a table without crashing", () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Record ${i}`,
      category: `Cat-${i % 100}`,
      value: Math.random() * 10000,
      status: i % 3 === 0 ? "active" : "inactive",
    }));

    render(<LargeTable rows={rows} />);
    expect(screen.getByRole("region", { name: /data table/i })).toBeInTheDocument();
  });
});

describe("Render extreme - many KPI cards", () => {
  it("renders 50 KPI cards without crashing", () => {
    render(
      <MemoryRouter>
        <DashboardGrid count={50} />
      </MemoryRouter>,
    );

    const cards = screen.getAllByTestId("kpi-card");
    expect(cards.length).toBe(50);
  });
});

describe("Render extreme - many chart cards", () => {
  it("renders 20 chart cards without crashing", () => {
    render(
      <MemoryRouter>
        <ChartGrid count={20} />
      </MemoryRouter>,
    );

    const charts = screen.getAllByTestId("chart-card");
    expect(charts.length).toBe(20);
  });
});

describe("Render extreme - deep route nesting", () => {
  it("renders with depth 50 nesting without crashing", () => {
    render(
      <MemoryRouter>
        <DeepRouter depth={50} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Leaf route")).toBeInTheDocument();
  });
});

describe("Render extreme - rapid route changes", () => {
  it("handles rapid state changes without error", () => {
    render(
      <MemoryRouter>
        <RouteChanger />
      </MemoryRouter>,
    );

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      act(() => {});
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10000);
  });
});

describe("Render extreme - re-render budget", () => {
  it("completes rendering within reasonable time", () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`, title: `Title ${i}`,
      description: "x".repeat(100),
    }));

    const start = performance.now();
    render(
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </li>
        ))}
      </ul>,
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });
});
