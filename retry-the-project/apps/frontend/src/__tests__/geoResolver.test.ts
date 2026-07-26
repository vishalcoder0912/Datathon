import { describe, expect, it } from "vitest";
import { hasResolvableGeoValue, resolveGeoLocation } from "@/features/dashboard/utils/geoResolver";

describe("geo resolver", () => {
  it("resolves country aliases and ISO codes", () => {
    expect(resolveGeoLocation("IN")).toMatchObject({ name: "India", kind: "country" });
    expect(resolveGeoLocation("U.S.")).toMatchObject({ name: "United States", kind: "country" });
    expect(resolveGeoLocation("America")).toMatchObject({ name: "United States", kind: "country" });
    expect(resolveGeoLocation("GB")).toMatchObject({ name: "United Kingdom", kind: "country" });
    expect(resolveGeoLocation("DE")).toMatchObject({ name: "Germany", kind: "country" });
    expect(resolveGeoLocation("JP")).toMatchObject({ name: "Japan", kind: "country" });
    expect(resolveGeoLocation("AU")).toMatchObject({ name: "Australia", kind: "country" });
  });

  it("resolves Indian states and major global cities", () => {
    expect(resolveGeoLocation("Uttar Pradesh")).toMatchObject({ name: "Uttar Pradesh", kind: "state" });
    expect(resolveGeoLocation("Karnataka")).toMatchObject({ name: "Karnataka", kind: "state" });
    expect(resolveGeoLocation("New York")).toMatchObject({ name: "New York", kind: "city" });
    expect(resolveGeoLocation("Dubai")).toMatchObject({ name: "Dubai", kind: "city" });
  });

  it("does not treat business regions as real locations", () => {
    expect(hasResolvableGeoValue("North")).toBe(false);
    expect(hasResolvableGeoValue("South")).toBe(false);
    expect(hasResolvableGeoValue("East")).toBe(false);
    expect(hasResolvableGeoValue("West")).toBe(false);
  });
});
