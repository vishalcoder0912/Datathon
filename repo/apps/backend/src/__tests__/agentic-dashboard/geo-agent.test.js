import { describe, expect, it } from "vitest";
import { buildSchemaProfile } from "../../services/ai-analyst/schema-fingerprint.js";
import { runSemanticAgent } from "../../services/agentic-dashboard/semantic-agent.js";
import { runGeoAgent } from "../../services/agentic-dashboard/geo-agent.js";

function geoFor(dataset) {
  const schemaProfile = buildSchemaProfile(dataset);
  const semanticProfile = runSemanticAgent(schemaProfile);
  return runGeoAgent({ schemaProfile: { ...schemaProfile, rows: dataset.rows || [] }, semanticProfile, ontology: { domain: schemaProfile.domain } });
}

describe("agentic dashboard geo agent", () => {
  it("enables maps when geo columns exist", () => {
    const geo = geoFor({
      name: "Geo",
      columns: ["state", "sales"],
      rows: [{ state: "CA", sales: 100 }],
    });

    expect(geo.enabled).toBe(true);
    expect(geo.maps[0]).toMatchObject({ geoKey: "state", metric: "sales" });
  });

  it("disables maps when geo columns are absent", () => {
    const geo = geoFor({
      name: "No Geo",
      columns: ["product", "sales"],
      rows: [{ product: "A", sales: 100 }],
    });

    expect(geo.enabled).toBe(false);
    expect(geo.maps).toEqual([]);
  });

  it("uses Country and Review Count for Amazon reviews without selecting sensitive text fields", () => {
    const geo = geoFor({
      name: "Amazon_Reviews",
      columns: [
        "Reviewer Name",
        "Profile Link",
        "Country",
        "Review Count",
        "Review Date",
        "Rating",
        "Review Title",
        "Review Text",
        "Date of Experience",
      ],
      rows: [
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
      ],
    });

    expect(geo.enabled).toBe(true);
    expect(geo.geo_field).toBe("Country");
    expect(geo.selected_metric).toBe("Review Count");
    expect(geo.aggregation).toBe("sum");
    expect(geo.map_type).toBe("country_choropleth");
    expect(geo.rejected_columns).toEqual(expect.arrayContaining(["Reviewer Name", "Profile Link", "Review Title", "Review Text"]));
    expect(geo.tooltips[0]).toMatchObject({ location: "United States", mainKpi: 9, records: 1, rank: 1 });
  });
});
