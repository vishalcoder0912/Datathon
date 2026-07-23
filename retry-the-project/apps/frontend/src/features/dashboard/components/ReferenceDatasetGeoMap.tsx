import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Globe2, LocateFixed, Maximize2, Minus, Plus } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import worldGeographies from "@/assets/maps/countries-110m.json";
import { extractGeoLocation, normalizeGeoValue } from "@/features/dashboard/utils/geoResolver";

type Row = Record<string, unknown>;
type Column = { name: string; type?: string; role?: string };
type Point = { key: string; name: string; raw: string; coordinates: [number, number]; records: number; value: number; source: string };
type Geo = { rsmKey: string; properties?: { name?: string } };

const clean = (value: unknown) => String(value ?? "").trim();
const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const formatValue = (value: number, metric: string) => /amount|billing|sales|revenue|profit|price|cost|salary|income|usd|inr/i.test(metric) ? `$${Math.round(value).toLocaleString()}` : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);

const findColumn = (columns: Column[], names: string[], regex: RegExp) =>
  columns.find((column) => names.includes(normalizeGeoValue(column.name)) || names.includes(normalizeGeoValue(column.type || "")) || names.includes(normalizeGeoValue(column.role || "")))?.name ||
  columns.find((column) => regex.test(normalizeGeoValue(column.name)) || regex.test(normalizeGeoValue(column.type || "")) || regex.test(normalizeGeoValue(column.role || "")))?.name ||
  "";

const inferLocationColumn = (rows: Row[], columns: Column[]) => {
  let best = "";
  let bestScore = 0;
  const candidates = columns.map((column) => column.name).filter((name) => !/id|phone|zip|postal|code|pin|date|time|month|year|url|link|amount|billing|age|room|doctor|name/i.test(name));
  for (const column of candidates) {
    const values = Array.from(new Set(rows.slice(0, 300).map((row) => clean(row[column])).filter(Boolean))).slice(0, 90);
    if (!values.length) continue;
    const hits = values.filter((value) => extractGeoLocation(value)).length;
    const ratio = hits / values.length;
    if (((hits >= 2 && ratio >= 0.35) || ratio >= 0.75) && hits + ratio > bestScore) {
      best = column;
      bestScore = hits + ratio;
    }
  }
  return best;
};

export default function ReferenceDatasetGeoMap({ rows, columns = [] }: { rows: Row[]; columns?: Column[] }) {
  const [metric, setMetric] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [clicked, setClicked] = useState<{ name: string; records: number; value: number; source: string; hasData: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([18, 18]);
  const schemaColumns = useMemo(() => (columns.length ? columns : Object.keys(rows[0] || {}).map((name) => ({ name }))), [columns, rows]);

  const schema = useMemo(() => {
    const lat = findColumn(schemaColumns, ["lat", "latitude"], /^(lat|latitude)$/);
    const lng = findColumn(schemaColumns, ["lng", "lon", "long", "longitude"], /^(lng|lon|long|longitude)$/);
    const country = findColumn(schemaColumns, ["country", "country_name", "nation"], /country|nation/);
    const state = findColumn(schemaColumns, ["state", "province", "territory"], /state|province|territory/);
    const city = findColumn(schemaColumns, ["city", "town", "hospital_city", "patient_city", "facility_city", "location_city"], /city|town/);
    const facility = findColumn(schemaColumns, ["hospital", "facility", "clinic", "medical_center", "medical_centre"], /hospital|facility|clinic|medical_center|medical_centre/);
    const inferred = inferLocationColumn(rows, schemaColumns);
    const location = country || state || city || inferred;
    const mode = lat && lng ? "coordinates" : country ? "country" : state ? "state" : city ? "city" : inferred ? "data values" : facility ? "entity-only" : "none";
    return { lat, lng, country, state, city, facility, inferred, location, mode };
  }, [rows, schemaColumns]);

  const metricColumns = useMemo(() => schemaColumns.map((column) => column.name).filter((name) => {
    if ([schema.lat, schema.lng].includes(name) || /id|phone|zip|postal|code|pin/i.test(name)) return false;
    return rows.slice(0, 100).map((row) => toNumber(row[name])).filter((value) => value !== null).length >= Math.min(3, Math.max(rows.length, 1));
  }), [rows, schemaColumns, schema.lat, schema.lng]);
  const metricColumn = metricColumns.includes(metric) ? metric : metricColumns[0] || "count";

  const points = useMemo<Point[]>(() => {
    if (!rows.length || !schema.location || schema.mode === "none" || schema.mode === "entity-only") return [];
    const bucket = new Map<string, { raw: string; records: number; sum: number; coordinates: [number, number]; name: string }>();
    rows.forEach((row, index) => {
      let location = null as ReturnType<typeof extractGeoLocation>;
      let raw = clean(row[schema.location]);
      if (schema.mode === "coordinates") {
        const lat = toNumber(row[schema.lat]);
        const lng = toNumber(row[schema.lng]);
        if (lat === null || lng === null) return;
        raw = clean(row[schema.country] || row[schema.state] || row[schema.city] || `Point ${index + 1}`);
        location = { name: raw, coordinates: [lng, lat], kind: "city" };
      } else {
        location = extractGeoLocation(raw);
      }
      if (!raw || !location) return;
      const key = normalizeGeoValue(location.name || raw);
      const current = bucket.get(key) || { raw, records: 0, sum: 0, coordinates: location.coordinates, name: location.name };
      current.records += 1;
      current.sum += metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
      bucket.set(key, current);
    });
    return Array.from(bucket.entries()).map(([key, item]) => ({ key, name: item.name, raw: item.raw, coordinates: item.coordinates, records: item.records, value: metricColumn === "count" ? item.records : item.sum / Math.max(item.records, 1), source: schema.mode })).sort((a, b) => b.value - a.value);
  }, [rows, schema, metricColumn]);

  const hasRealGeo = points.length > 0;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const maxRecords = Math.max(...points.map((point) => point.records), 1);
  const colorScale = scaleLinear<string>().domain([minValue, maxValue]).range(["#c4b5fd", "#6d28d9"]);
  const active = points.find((point) => point.key === activeKey) || points[0];
  const mappedRecords = points.reduce((sum, point) => sum + point.records, 0);

  const chooseLocation = (point: Point) => {
    setActiveKey(point.key);
    setClicked({ name: point.name, records: point.records, value: point.value, source: point.source, hasData: true });
    setCenter(point.coordinates);
    setZoom((current) => Math.max(current, 1.6));
  };

  const chooseCountry = (name: string) => {
    const match = points.find((point) => normalizeGeoValue(point.name) === normalizeGeoValue(name) || normalizeGeoValue(point.raw) === normalizeGeoValue(name));
    if (match) return chooseLocation(match);
    setClicked({ name, records: 0, value: 0, source: schema.location || "location required", hasData: false });
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"><Globe2 className="size-3.5" />Reference-style geo intelligence</div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Interactive Map Analytics</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{hasRealGeo ? <>Field: <span className="font-bold text-slate-700">{schema.location || "coordinates"}</span>. Click a country or marker to inspect real rows.</> : <>Map shell is ready. Add <span className="font-bold text-slate-700">City, State, Country, Latitude, or Longitude</span> to plot dataset records.</>}</p>
        </div>
        {metricColumns.length > 0 && <select value={metricColumn} onChange={(event) => setMetric(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-300"><option value="count">Record Count</option>{metricColumns.map((column) => <option key={column} value={column}>{pretty(column)} Avg</option>)}</select>}
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Mapped records" value={mappedRecords.toLocaleString()} subtitle={hasRealGeo ? `${points.length} locations` : "Geo field required"} />
        <Stat title="Metric" value={metricColumn === "count" ? "Count" : pretty(metricColumn)} subtitle="Click map to inspect" />
        <Stat title="Map source" value={hasRealGeo ? schema.mode : "Missing"} subtitle={schema.location || "location required"} />
        <Stat title="Rows" value={rows.length.toLocaleString()} subtitle="Dataset records" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.55fr_.85fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-[#f8fafc] sm:min-h-[520px] lg:min-h-[620px]">
          <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
            <button type="button" onClick={() => setZoom((value) => Math.min(6, value + 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Plus className="size-4" /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Minus className="size-4" /></button>
            <button type="button" onClick={() => { setZoom(1); setCenter([18, 18]); setActiveKey(null); setClicked(null); }} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Maximize2 className="size-4" /></button>
          </div>
          {!hasRealGeo && <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-amber-100 bg-white/95 p-4 text-sm leading-6 text-amber-800 shadow-sm backdrop-blur"><strong>Location schema required:</strong> the world map is active, but plotted analytics need City, State, Country, Latitude, or Longitude columns.</div>}
          <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 165 }} className="absolute inset-0 h-full w-full">
            <rect width="800" height="600" fill="#f8fafc" />
            <ZoomableGroup zoom={zoom} center={center} onMoveEnd={(position: { coordinates: [number, number]; zoom: number }) => { setCenter(position.coordinates); setZoom(position.zoom); }}>
              <Geographies geography={worldGeographies}>{({ geographies }: { geographies: Geo[] }) => geographies.map((geo) => {
                const countryName = geo.properties?.name || "Unknown country";
                const match = points.find((point) => normalizeGeoValue(point.name) === normalizeGeoValue(countryName) || normalizeGeoValue(point.raw) === normalizeGeoValue(countryName));
                return <Geography key={geo.rsmKey} geography={geo} fill={match ? colorScale(match.value) : "#e2e8f0"} stroke="#ffffff" strokeWidth={0.55} style={{ default: { outline: "none", transition: "fill .18s ease" }, hover: { fill: match ? "#8b5cf6" : "#cbd5e1", outline: "none", cursor: "pointer" }, pressed: { outline: "none" } }} onMouseEnter={() => match && setActiveKey(match.key)} onMouseLeave={() => setActiveKey(null)} onClick={() => chooseCountry(countryName)} />;
              })}</Geographies>
              {points.map((point) => {
                const radius = 5 + (point.records / maxRecords) * 13;
                const isActive = activeKey === point.key || clicked?.name === point.name;
                return <Marker key={point.key} coordinates={point.coordinates} onClick={() => chooseLocation(point)} onMouseEnter={() => setActiveKey(point.key)} onMouseLeave={() => setActiveKey(null)}>
                  <circle r={radius + 8} fill="#8b5cf6" opacity={isActive ? 0.22 : 0.1}><animate attributeName="r" values={`${radius + 3};${radius + 14};${radius + 3}`} dur="2.3s" repeatCount="indefinite" /></circle>
                  <circle r={radius} fill={colorScale(point.value)} stroke="#ffffff" strokeWidth={2} />
                  {isActive && <text y={-radius - 10} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">{point.name}</text>}
                </Marker>;
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>
        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><LocateFixed className="size-4 text-violet-700" /><h3 className="text-sm font-black text-slate-950">Clicked location</h3></div><div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-base font-black text-slate-950">{clicked?.name || active?.name || "Click a country or marker"}</h4><div className="mt-3 space-y-2 text-xs text-slate-600"><Info label="Records" value={(clicked?.records ?? active?.records ?? 0).toLocaleString()} /><Info label={metricColumn === "count" ? "Count" : pretty(metricColumn)} value={(clicked && !clicked.hasData) ? "No mapped rows" : formatValue(clicked?.value ?? active?.value ?? 0, metricColumn)} /><Info label="Source" value={clicked?.source || active?.source || schema.mode} /></div></div></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-black text-slate-950">Top mapped locations</h3><div className="mt-4 space-y-3">{hasRealGeo ? points.slice(0, 8).map((point, index) => <button key={point.key} type="button" onClick={() => chooseLocation(point)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-violet-200 hover:bg-violet-50"><span className="min-w-0"><span className="text-xs font-bold text-slate-400">#{index + 1}</span> <span className="ml-2 text-sm font-bold text-slate-800">{point.name}</span><span className="block pl-7 text-[11px] text-slate-500">{point.records.toLocaleString()} rows</span></span><span className="shrink-0 text-xs font-black text-violet-700">{formatValue(point.value, metricColumn)}</span></button>) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">No ranked locations yet. Add a real location column to calculate rankings.</div>}</div></section>
        </aside>
      </div>
    </motion.section>
  );
}

function Stat({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{value}</span></div>;
}
