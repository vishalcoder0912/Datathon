import { describe, expect, it } from "vitest";
import {
  computeGeoIntelligence,
  detectGeoField,
  detectMetricField,
} from "@/features/dashboard/geo/geoIntelligenceEngine";

describe("geo intelligence engine", () => {
  it("uses Country and sums Review Count text values for Amazon reviews", () => {
    const columns = [
      "Reviewer Name",
      "Profile Link",
      "Country",
      "Review Count",
      "Review Date",
      "Rating",
      "Review Title",
      "Review Text",
      "Date of Experience",
    ];
    const rows = [
      {
        "Reviewer Name": "A",
        "Profile Link": "https://example.test/a",
        Country: "USA",
        "Review Count": "9 reviews",
        Rating: "Rated 4 out of 5 stars",
        "Review Title": "Useful",
        "Review Text": "Good product",
      },
      {
        "Reviewer Name": "B",
        "Profile Link": "https://example.test/b",
        Country: "India",
        "Review Count": "3 reviews",
        Rating: "Rated 5 out of 5 stars",
        "Review Title": "Great",
        "Review Text": "Fast delivery",
      },
    ];

    const geoField = detectGeoField(columns);
    const metricField = detectMetricField(columns, rows);
    const result = computeGeoIntelligence(rows, geoField!, metricField!);

    expect(geoField).toBe("Country");
    expect(metricField).toBe("Review Count");
    expect(result.aggregation).toBe("sum");
    expect(result.topLocation).toMatchObject({
      name: "United States",
      metricValue: 9,
      recordCount: 1,
    });
  });

  it("does not highlight unknown or invalid locations", () => {
    const rows = [
      { Country: "Unknown", "Review Count": "99 reviews" },
      { Country: "N/A", "Review Count": "40 reviews" },
      { Country: "USA", "Review Count": "9 reviews" },
    ];

    const result = computeGeoIntelligence(rows, "Country", "Review Count");

    expect(result.enabled).toBe(true);
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0]).toMatchObject({
      name: "United States",
      metricValue: 9,
    });
  });
});
