import { describe, expect, it } from "vitest";
import { buildSchemaProfile } from "../services/ai-analyst/schema-profiler.js";

describe("Schema Profiler", () => {
  it("generates correct column metadata and statistics", () => {
    const dataset = {
      name: "Test Dataset",
      columns: ["country", "salary_usd", "experience", "joined_date"],
      rows: [
        { country: "USA", salary_usd: 100000, experience: 5, joined_date: "2020-01-01" },
        { country: "India", salary_usd: 50000, experience: 2, joined_date: "2021-06-15" },
        { country: "UK", salary_usd: 80000, experience: 4, joined_date: "2019-11-20" },
        { country: "USA", salary_usd: null, experience: 8, joined_date: "2018-05-10" }
      ]
    };

    const profile = buildSchemaProfile(dataset);

    expect(profile.datasetName).toBe("Test Dataset");
    expect(profile.rowCount).toBe(4);
    expect(profile.columnCount).toBe(4);

    // Verify country column
    const countryCol = profile.columns.find(c => c.name === "country");
    expect(countryCol).toBeDefined();
    expect(countryCol.type).toBe("string");
    expect(countryCol.role).toBe("dimension");
    expect(countryCol.uniqueCount).toBe(3);
    expect(countryCol.nullCount).toBe(0);

    // Verify salary_usd column
    const salaryCol = profile.columns.find(c => c.name === "salary_usd");
    expect(salaryCol).toBeDefined();
    expect(salaryCol.type).toBe("number");
    expect(salaryCol.role).toBe("metric");
    expect(salaryCol.nullCount).toBe(1);
    expect(salaryCol.stats).toBeDefined();
    expect(salaryCol.stats.min).toBe(50000);
    expect(salaryCol.stats.max).toBe(100000);
    expect(salaryCol.stats.avg).toBe(76666.67);
  });
});
