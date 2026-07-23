import type { GeoLocationData } from "./geoIntelligenceEngine";

interface GeoRankingPanelProps {
  locations: GeoLocationData[];
  onCountryClick: (country: string) => void;
}

export default function GeoRankingPanel({
  locations,
  onCountryClick,
}: GeoRankingPanelProps) {
  const top5 = locations.slice(0, 5);

  if (!top5.length) return null;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-[#0F172A]">
        Top Locations
      </h3>
      <div className="space-y-2">
        {top5.map((loc, index) => {
          const maxValue = top5[0].metricValue;
          const pct = maxValue > 0 ? (loc.metricValue / maxValue) * 100 : 0;

          return (
            <button
              key={loc.name}
              type="button"
              onClick={() => onCountryClick(loc.name)}
              className="w-full rounded-xl border border-transparent p-2 text-left transition hover:border-violet-200 hover:bg-violet-50/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-50 text-xs font-bold text-[#7C3AED]">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-semibold text-[#334155]">{loc.name}</span>
                </div>
                <span className="shrink-0 text-sm font-bold text-[#7C3AED]">{loc.kpiFormatted}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-[#64748B]">
                <span>{loc.recordCount.toLocaleString()} records</span>
                <span>#{loc.rank}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
