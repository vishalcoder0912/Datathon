import type { GeoLocationData } from "./geoIntelligenceEngine";

interface GeoKPICardsProps {
  topLocation: GeoLocationData | null;
  bottomLocation: GeoLocationData | null;
  totalLocations: number;
  averageMetric: number;
  totalRecords: number;
  metricField: string;
  activityLabel: string;
  geoField: string;
}

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMetricValue(value: number, field: string): string {
  if (!field || field === "__count__") return value.toLocaleString();

  const normalized = field.toLowerCase();
  if (/salary|revenue|sales|profit|income|price|cost|budget|amount/.test(normalized)) {
    return USD_FORMATTER.format(value);
  }

  if (/percent|rate|ratio/.test(normalized)) return `${value.toFixed(2)}%`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function GeoKPICards({
  topLocation,
  bottomLocation: _bottomLocation,
  totalLocations,
  averageMetric,
  totalRecords,
  metricField,
  activityLabel,
  geoField,
}: GeoKPICardsProps) {
  const cards = [
    {
      label: "Field Used",
      value: geoField.replace(/_/g, " "),
      subtitle: "Detected geographic column",
      color: "border-l-[#06B6D4]",
    },
    {
      label: "Locations",
      value: totalLocations.toLocaleString(),
      subtitle: "Countries/regions with data",
      color: "border-l-[#7C3AED]",
    },
    {
      label: "Top Location",
      value: topLocation?.name || "-",
      subtitle: topLocation ? `${topLocation.kpiLabel}: ${topLocation.kpiFormatted}` : "No data available",
      color: "border-l-[#22C55E]",
    },
    {
      label: "Average",
      value: formatMetricValue(averageMetric, metricField),
      subtitle: `Across ${totalLocations} locations`,
      color: "border-l-[#2563EB]",
    },
    {
      label: "Total Records",
      value: totalRecords.toLocaleString(),
      subtitle: activityLabel,
      color: "border-l-[#F59E0B]",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border border-[#E2E8F0] bg-white p-4 ${card.color} border-l-4 shadow-sm`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{card.label}</p>
          <p className="mt-2 truncate text-lg font-bold text-[#0F172A]">{card.value}</p>
          <p className="mt-1 truncate text-xs text-[#64748B]">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
