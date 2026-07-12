import { describe, expect, it } from "vitest";
import { buildSchemaProfile, makeSchemaOnlyPacket } from "../services/ai-analyst/schema-fingerprint.js";
import { salaryDataset } from "./test-helpers.js";

describe("schema fingerprint", () => {
  it("detects schema roles and excludes raw rows from schema-only packet", () => {
    const profile = buildSchemaProfile(salaryDataset);
    const packet = makeSchemaOnlyPacket(profile);
    const country = profile.columns.find((column) => column.name === "country");
    const salary = profile.columns.find((column) => column.name === "salary_usd");
    const experience = profile.columns.find((column) => column.name === "experience");

    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(3);
    expect(["location", "category"]).toContain(country.role);
    expect(salary.role).toBe("money_metric");
    expect(["continuous_metric", "count_metric"]).toContain(experience.role);
    expect(JSON.stringify(packet)).not.toContain("\"rows\"");
    expect(JSON.stringify(packet)).not.toContain("50000");
    expect(JSON.stringify(packet)).not.toContain("India");
    expect(packet.columns.find((column) => column.name === "salary_usd")).not.toHaveProperty("stats");
    expect(packet.columns.find((column) => column.name === "country")).not.toHaveProperty("topValues");
    expect(packet.columns.find((column) => column.name === "country")).toHaveProperty("topValuesCount");
  });

  it("can explicitly include value-bearing metadata for trusted local-only callers", () => {
    const profile = buildSchemaProfile(salaryDataset);
    const packet = makeSchemaOnlyPacket(profile, {
      includeStats: true,
      includeTopValues: true,
    });

    expect(packet.columns.find((column) => column.name === "salary_usd")).toHaveProperty("stats");
    expect(packet.columns.find((column) => column.name === "country").topValues).toContain("India");
  });

  it("does not classify language fields as age metrics", () => {
    const profile = buildSchemaProfile({
      name: "salary skills",
      rows: [
        { experience: 4, languages: "Python, JavaScript", frameworks: "React", salary_usd: 90000 },
        { experience: 6, languages: "Go, Python", frameworks: "Django", salary_usd: 120000 },
      ],
      columns: [
        { name: "experience", type: "number" },
        { name: "languages", type: "string" },
        { name: "frameworks", type: "string" },
        { name: "salary_usd", type: "currency" },
      ],
    });

    expect(profile.columns.find((column) => column.name === "experience").role).toBe("continuous_metric");
    expect(profile.columns.find((column) => column.name === "languages").role).toBe("category");
    expect(profile.columns.find((column) => column.name === "frameworks").role).toBe("category");
    expect(profile.columns.find((column) => column.name === "salary_usd").role).toBe("money_metric");
  });
});
