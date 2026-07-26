import { useMemo, useState, useCallback } from "react";
import { Globe, RotateCcw, MapPin, Lightbulb } from "lucide-react";
import type { Row } from "@/features/dashboard/utils/dashboardAnalytics";
import GeoIntelligenceMap from "./GeoIntelligenceMap";
import GeoRankingPanel from "./GeoRankingPanel";
import GeoKPICards from "./GeoKPICards";
import {
  detectGeoField,
  detectMetricField,
  computeGeoIntelligence,
  type GeoIntelligenceResult,
} from "./geoIntelligenceEngine";

interface GeoIntelligenceProps {
  rows: Row[];
  columns: string[];
  onFilterByCountry?: (country: string) => void;
}

const METRIC_OPTIONS_PRIORITY = [
  "revenue", "profit", "sales", "billing_amount", "billingamount",
  "salary_usd", "salary", "orders", "customers", "patients",
  "review_count", "reviewcount", "rating", "risk_score", "riskscore",
  "amount", "price", "cost", "quantity",
];

export default function GeoIntelligence({
  rows,
  columns,
  onFilterByCountry,
}: GeoIntelligenceProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>("auto");
  const [hasFilter, setHasFilter] = useState(false);

  const geoField = useMemo(() => detectGeoField(columns), [columns]);

  const availableMetrics = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    const candidates = columns.map((column) => ({
      column,
      lower: column.toLowerCase(),
      normalized: column.toLowerCase().replace(/[_\s-]/g, ""),
    }));

    for (const mp of METRIC_OPTIONS_PRIORITY) {
      const normalizedPriority = mp.replace(/_/g, "");
      for (const candidate of candidates) {
        if (
          !seen.has(candidate.column) &&
          (candidate.normalized.includes(normalizedPriority) || candidate.lower.includes(mp))
        ) {
          result.push(candidate.column);
          seen.add(candidate.column);
          break;
        }
      }
    }

    return result;
  }, [columns]);

  const resolvedMetric = useMemo(() => {
    if (selectedMetric !== "auto") return selectedMetric;
    return detectMetricField(columns, rows) || "__count__";
  }, [columns, rows, selectedMetric]);

  const geoResult: GeoIntelligenceResult | null = useMemo(() => {
    if (!geoField) return null;
    return computeGeoIntelligence(rows, geoField, resolvedMetric);
  }, [rows, geoField, resolvedMetric]);

  const handleCountryClick = useCallback(
    (country: string) => {
      if (onFilterByCountry) {
        onFilterByCountry(country);
        setHasFilter(true);
      }
    },
    [onFilterByCountry],
  );

  const handleResetFilter = useCallback(() => {
    if (onFilterByCountry) {
      onFilterByCountry("");
      setHasFilter(false);
    }
  }, [onFilterByCountry]);

  if (!geoField || !geoResult || !geoResult.enabled) return null;

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] shadow-lg shadow-violet-500/20">
              <Globe className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">Geo Intelligence</h2>
              <p className="text-xs text-[#64748B]">
                {geoResult.totalLocations} locations - {geoResult.activityLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <MapPin className="size-3.5 text-[#64748B]" />
              <span className="text-xs font-semibold text-[#334155]">Field: {geoField}</span>
            </div>

            {availableMetrics.length > 1 && (
              <select
                value={selectedMetric}
                aria-label="Select Geo Intelligence metric"
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] outline-none"
              >
                <option value="auto">Auto (Best Metric)</option>
                {availableMetrics.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            )}

            {hasFilter && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                <RotateCcw className="size-3" />
                Reset Map
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        <GeoKPICards
          topLocation={geoResult.topLocation}
          bottomLocation={geoResult.bottomLocation}
          totalLocations={geoResult.totalLocations}
          averageMetric={geoResult.averageMetric}
          totalRecords={geoResult.totalRecords}
          metricField={geoResult.metricField}
          activityLabel={geoResult.activityLabel}
          geoField={geoResult.geoField}
        />
      </div>

      <div className="grid gap-4 border-t border-[#E2E8F0] p-5 lg:grid-cols-[1fr_300px]">
        <div className="min-h-[300px] rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-2">
          <GeoIntelligenceMap
            locations={geoResult.locations}
            onCountryClick={handleCountryClick}
            metricField={geoResult.metricField}
            activityLabel={geoResult.activityLabel}
          />
          <div className="flex items-center justify-center gap-4 px-4 pb-2 pt-1 text-xs text-[#64748B]">
            <span className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-sm bg-slate-200" />
              No data
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-sm bg-violet-500/40" />
              Low
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-sm bg-violet-500/80" />
              Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-sm bg-violet-500" />
              High
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <GeoRankingPanel
            locations={geoResult.locations}
            onCountryClick={handleCountryClick}
          />

          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#334155]">
              <Lightbulb className="size-3.5 text-[#F59E0B]" />
              AI Geo Insight
            </div>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              {geoResult.summaryInsight}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
