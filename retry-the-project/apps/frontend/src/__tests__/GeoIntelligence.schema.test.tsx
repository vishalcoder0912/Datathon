import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GeoIntelligence from "@/features/dashboard/geo/GeoIntelligence";

// Mock the GeoIntelligenceMap as it contains SVG maps that don't need real browser sizing in unit tests
vi.mock("../features/dashboard/geo/GeoIntelligenceMap", () => ({
  default: () => <div data-testid="geo-map">Mocked Map</div>,
}));

const geoRows = [
  { country: "India", salary_usd: 50000, experience: 2 },
  { country: "USA", salary_usd: 90000, experience: 5 },
  { country: "India", salary_usd: 65000, experience: 3 }
];

const geoColumns = ["country", "salary_usd", "experience"];

describe("GeoIntelligence UI component", () => {
  it("renders Geo Intelligence details when country exists", () => {
    render(
      <GeoIntelligence
        rows={geoRows}
        columns={geoColumns}
        onFilterByCountry={vi.fn()}
      />
    );

    // Should display Geo Intelligence header
    expect(screen.getByText("Geo Intelligence")).toBeInTheDocument();
    
    // Field label country
    expect(screen.getByText("Field: country")).toBeInTheDocument();

    // Verify top location KPI card shows United States
    expect(screen.getAllByText("United States").length).toBeGreaterThan(0);

    // Verify locations count (2 detected: India, USA)
    expect(screen.getAllByText(/2 locations/i).length).toBeGreaterThan(0);
  });

  it("renders null (returns empty/hidden state) when no geo field exists", () => {
    const noGeoColumns = ["job_title", "salary_usd", "experience"];
    const noGeoRows = [
      { job_title: "Developer", salary_usd: 50000, experience: 2 }
    ];

    const { container } = render(
      <GeoIntelligence
        rows={noGeoRows}
        columns={noGeoColumns}
        onFilterByCountry={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
