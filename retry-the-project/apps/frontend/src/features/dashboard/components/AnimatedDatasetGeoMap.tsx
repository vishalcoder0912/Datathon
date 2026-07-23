import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Globe2, LocateFixed, Maximize2, Minus, Plus } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import worldGeographies from "@/assets/maps/countries-110m.json";
import { extractGeoLocation, normalizeGeoValue } from "@/features/dashboard/utils/geoResolver";

type Row = Record<string, unknown>;
type Column = { name: string; type?: string; role?: string };
type Props = { rows: Row[]; columns?: Column[] };

type GeoPoint = {
  key: string;
  name: string;
  raw: string;
  coordinates: [number, number];
  records: number;
  value: number;
  source: string;
};

type MapGeography = { rsmKey: string; properties?: { name?: string } };

type SelectedCountry = {
  name: string;
  records: number;
  value: number;
  source: string;
  hasData: boolean;
};

const clean = (value: unknown) => String(value ?? "").trim();
const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const moneyLike = (metric: string) => /revenue|sales|profit|amount|price|cost|salary|income|billing|usd|inr/i.test(metric);

const formatValue = (value: number, metric: string) => {
  if (moneyLike(metric)) return `$${Math.round(value).toLocaleString()}`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
};

const findColumn = (columns: Column[], names: string[], regex: RegExp) =>
  columns.find((column) => names.includes(normalizeGeoValue(column.name)) || names.includes(normalizeGeoValue(column.type || "")) || names.includes(normalizeGeoValue(column.role || "")))?.name ||
  columns.find((column) => regex.test(normalizeGeoValue(column.name)) || regex.test(normalizeGeoValue(column.type || "")) || regex.test(normalizeGeoValue(column.role || "")))?.name ||
  "";

const inferLocationColumn = (rows: Row[], columns: Column[]) => {
  let best: { column: string; ratio: number; hits: number } | null = null;
  const candidates = columns.map((column) => column.name).filter((name) => !/id|phone|zip|postal|code|pin|date|time|month|year|url|link|amount|billing|age|room|doctor|name/i.test(name));

  for (const column of candidates) {
    const values = Array.from(new Set(rows.slice(0, 300).map((row) => clean(row[column])).filter(Boolean))).slice(0, 90);
    if (!values.length) continue;
    const hits = values.filter((value) => extractGeoLocation(value)).length;
    const ratio = hits / values.length;
    if ((hits >= 2 && ratio >= 0.35) || ratio >= 0.75) {
      if (!best || ratio > best.ratio || hits > best.hits) best = { column, ratio, hits };
    }
  }
  return best?.column || "";
};

export default function AnimatedDatasetGeoMap({ rows, columns = [] }: Props) {
  const [metric, setMetric] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([20, 18]);

  const schemaColumns = useMemo(() => (columns.length ? columns : Object.keys(rows[0] || {}).map((name) => ({ name }))), [columns, rows]);

  const schema = useMemo(() => {
    const lat = findColumn(schemaColumns, ["lat", "latitude"], /^(lat|latitude)$/);
    const lng = findColumn(schemaColumns, ["lng", "lon", "long", "longitude"], /^(lng|lon|long|longitude)$/);
    const country = findColumn(schemaColumns, ["country", "country_name", "nation"], /country|nation/);
    const state = findColumn(schemaColumns, ["state", "province", "territory"], /state|province|territory/);
    const city = findColumn(schemaColumns, ["city", "town", "hospital_city", "patient_city", "facility_city", "location_city"], /city|town/);
    const facility = findColumn(schemaColumns, ["hospital", "facility", "clinic", "medical_center", "medical_centre"], /hospital|facility|clinic|medical_center|medical_centre/);
    const inferred = inferLocationColumn(rows, schemaColumns);
    const location = city || state || country || inferred;
    const mode = lat && lng ? "coordinates" : country ? "country" : state ? "state" : city ? "city" : inferred ? "data values" : facility ? "facility needs city" : "none";
    return { lat, lng, country, state, city, facility, inferred, location, mode };
  }, [rows, schemaColumns]);

  const metricColumns = useMemo(
    () => schemaColumns.map((column) => column.name).filter((name) => {
      if ([schema.lat, schema.lng].includes(name)) return false;
      if (/id|phone|zip|postal|code|pin/i.test(name)) return false;
      const values = rows.slice(0, 100).map((row) => toNumber(row[name])).filter((value) => value !== null);
      return values.length >= Math.min(3, Math.max(rows.length, 1));
    }),
    [rows, schemaColumns, schema.lat, schema.lng],
  );

  const metricColumn = metricColumns.includes(metric) ? metric : metricColumns[0] || "count";

  const points = useMemo<GeoPoint[]>(() => {
    if (!rows.length || schema.mode === "none" || schema.mode === "facility needs city") return [];

    if (schema.mode === "coordinates") {
      return rows.map((row, index) => {
        const lat = toNumber(row[schema.lat]);
        const lng = toNumber(row[schema.lng]);
        if (lat === null || lng === null) return null;
        const name = clean(row[schema.city] || row[schema.state] || row[schema.country] || `Point ${index + 1}`);
        const value = metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
        return { key: `pt-${index}`, name, raw: name, coordinates: [lng, lat] as [number, number], records: 1, value, source: "coordinates" };
      }).filter((item): item is GeoPoint => Boolean(item)).slice(0, 700);
    }

    const bucket = new Map<string, { raw: string; records: number; sum: number; location: NonNullable<ReturnType<typeof extractGeoLocation>> }>();
    rows.forEach((row) => {
      const raw = clean(row[schema.location]);
      const location = extractGeoLocation(raw);
      if (!raw || !location) return;
      const key = normalizeGeoValue(location.name || raw);
      const current = bucket.get(key) || { raw, records: 0, sum: 0, location };
      current.records += 1;
      current.sum += metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
      bucket.set(key, current);
    });

    return Array.from(bucket.entries()).map(([key, item]) => ({
      key,
      name: item.location.name,
      raw: item.raw,
      coordinates: item.location.coordinates,
      records: item.records,
      value: metricColumn === "count" ? item.records : item.sum / Math.max(item.records, 1),
      source: schema.mode,
    })).sort((a, b) => b.value - a.value);
  }, [rows, schema, metricColumn]);

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const maxRecords = Math.max(...points.map((point) => point.records), 1);
  const colorScale = scaleLinear<string>().domain([minValue, maxValue]).range(["#ddd6fe", "#6d28d9"]);
  const active = points.find((point) => point.key === activeKey) || points[0];
  const mappedRecords = points.reduce((sum, point) => sum + point.records, 0);
  const unmapped = schema.location ? rows.filter((row) => clean(row[schema.location]) && !extractGeoLocation(row[schema.location])).length : 0;

  const selectCountry = (countryName: string) => {
    const normalized = normalizeGeoValue(countryName);
    const match = points.find((point) => normalizeGeoValue(point.name) === normalized || normalizeGeoValue(point.raw) === normalized);
    if (match) {
      setActiveKey(match.key);
      setSelectedCountry({ name: match.name, records: match.records, value: match.value, source: match.source, hasData: true });
      setCenter(match.coordinates);
      setZoom((current) => Math.max(current, 1.65));
      return;
    }
    setActiveKey(null);
    setSelectedCountry({ name: countryName, records: 0, value: 0, source: schema.location || "schema", hasData: false });
  };

  if (schema.mode === "facility needs city") {
    return <GeoEmpty title="Real map needs a location column" message={`Detected ${schema.facility}, but hospital names alone are not real map coordinates. Add Hospital City, City, State, Country, Latitude, or Longitude to plot animated markers and country click analytics.`} />;
  }

  if (schema.mode === "none") {
    return <GeoEmpty title="No real location schema found" message="Add Country, City, State, Latitude/Longitude, or a text column with real place names. Then the map will animate markers and show click-based analytics from actual rows." />;
  }

  if (!points.length) {
    return <GeoEmpty title="Location field found, but values were not mappable" message={`Detected ${schema.mode}. Use recognizable country/city/state names like India, Delhi, USA, Germany, or exact latitude and longitude columns.`} />;
  }

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"><Globe2 className="size-3.5" />Animated real-data map</div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Interactive Geo Intelligence</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Source: <span className="font-bold text-slate-700">{schema.mode}</span> · field: <span className="font-bold text-slate-700">{schema.location || "coordinates"}</span>. Click a mapped country or marker to inspect records calculated from the dataset.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {metricColumns.length > 0 && <select value={metricColumn} onChange={(event) => setMetric(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-300"><option value="count">Record Count</option>{metricColumns.map((column) => <option key={column} value={column}>{pretty(column)} Avg</option>)}</select>}
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Mapped records" value={mappedRecords.toLocaleString()} subtitle={`${points.length} locations`} />
        <Stat title="Metric" value={metricColumn === "count" ? "Count" : pretty(metricColumn)} subtitle="Click map to inspect" />
        <Stat title="Map source" value={schema.mode === "data values" ? "Values" : "Schema"} subtitle={schema.location || "coordinates"} />
        <Stat title="Unmapped" value={unmapped.toLocaleString()} subtitle="Rows skipped" muted={unmapped === 0} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.55fr_.85fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 sm:min-h-[520px] lg:min-h-[620px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,.28),transparent_28%),radial-gradient(circle_at_72%_65%,rgba(14,165,233,.16),transparent_32%)]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/20 animate-ping" />
          <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/90 p-1 shadow-sm backdrop-blur">
            <button type="button" onClick={() => setZoom((value) => Math.min(6, value + 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Plus className="size-4" /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Minus className="size-4" /></button>
            <button type="button" onClick={() => { setZoom(1); setCenter([20, 18]); setActiveKey(null); setSelectedCountry(null); }} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Maximize2 className="size-4" /></button>
          </div>

          <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 165 }} className="absolute inset-0 h-full w-full">
            <rect width="800" height="600" fill="transparent" />
            <ZoomableGroup zoom={zoom} center={center} onMoveEnd={(position: { coordinates: [number, number]; zoom: number }) => { setCenter(position.coordinates); setZoom(position.zoom); }}>
              <Geographies geography={worldGeographies}>{({ geographies }: { geographies: MapGeography[] }) => geographies.map((geo) => {
                const countryName = geo.properties?.name || "Unknown country";
                const normalized = normalizeGeoValue(countryName);
                const match = points.find((point) => normalizeGeoValue(point.name) === normalized || normalizeGeoValue(point.raw) === normalized);
                return <Geography key={geo.rsmKey} geography={geo} fill={match ? colorScale(match.value) : "#334155"} stroke="#0f172a" strokeWidth={0.5} style={{ default: { outline: "none", transition: "fill .18s ease" }, hover: { fill: match ? "#8b5cf6" : "#475569", outline: "none", cursor: "pointer" }, pressed: { outline: "none" } }} onMouseEnter={() => match && setActiveKey(match.key)} onMouseLeave={() => setActiveKey(null)} onClick={() => selectCountry(countryName)} />;
              })}</Geographies>
              {points.map((point) => {
                const radius = 5 + (point.records / maxRecords) * 13;
                const isActive = activeKey === point.key || selectedCountry?.name === point.name;
                return <Marker key={point.key} coordinates={point.coordinates} onClick={() => { setActiveKey(point.key); setSelectedCountry({ name: point.name, records: point.records, value: point.value, source: point.source, hasData: true }); }} onMouseEnter={() => setActiveKey(point.key)} onMouseLeave={() => setActiveKey(null)}>
                  <circle r={radius + 8} fill="#a78bfa" opacity={isActive ? 0.25 : 0.12}><animate attributeName="r" values={`${radius + 3};${radius + 14};${radius + 3}`} dur="2.4s" repeatCount="indefinite" /></circle>
                  <circle r={radius} fill={colorScale(point.value)} stroke="#ffffff" strokeWidth={2} />
                  {isActive && <text y={-radius - 10} textAnchor="middle" fontSize={11} fontWeight={800} fill="#ffffff">{point.name}</text>}
                </Marker>;
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        <aside className="space-y-4">
          <motion.section layout className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><LocateFixed className="size-4 text-violet-700" /><h3 className="text-sm font-black text-slate-950">Clicked location</h3></div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-black text-slate-950">{selectedCountry?.name || active?.name || "Click a country or marker"}</h4>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <Info label="Records" value={(selectedCountry?.records ?? active?.records ?? 0).toLocaleString()} />
                <Info label={metricColumn === "count" ? "Count" : pretty(metricColumn)} value={(selectedCountry && !selectedCountry.hasData) ? "No mapped rows" : formatValue(selectedCountry?.value ?? active?.value ?? 0, metricColumn)} />
                <Info label="Source" value={selectedCountry?.source || active?.source || schema.mode} />
              </div>
              {selectedCountry && !selectedCountry.hasData && <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">This country has no rows because the dataset schema does not contain matching country/city/state values for it.</p>}
            </div>
          </motion.section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Top mapped locations</h3>
            <div className="mt-4 space-y-3">
              {points.slice(0, 8).map((point, index) => <button key={point.key} type="button" onClick={() => { setActiveKey(point.key); setSelectedCountry({ name: point.name, records: point.records, value: point.value, source: point.source, hasData: true }); setCenter(point.coordinates); setZoom((value) => Math.max(value, 1.65)); }} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-violet-200 hover:bg-violet-50"><span className="min-w-0"><span className="text-xs font-bold text-slate-400">#{index + 1}</span> <span className="ml-2 text-sm font-bold text-slate-800">{point.name}</span><span className="block pl-7 text-[11px] text-slate-500">{point.records.toLocaleString()} rows</span></span><span className="shrink-0 text-xs font-black text-violet-700">{formatValue(point.value, metricColumn)}</span></button>)}
            </div>
          </section>
        </aside>
      </div>
    </motion.section>
  );
}

function GeoEmpty({ title, message }: { title: string; message: string }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"><div className="relative mx-auto mb-5 grid size-20 place-items-center rounded-3xl bg-violet-50 text-violet-600"><span className="absolute inset-0 rounded-3xl bg-violet-100 animate-ping" /><Globe2 className="relative size-9" /></div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{message}</p><div className="mx-auto mt-5 max-w-xl rounded-2xl border border-slate-200 bg-slate-950 p-4 text-left font-mono text-xs leading-6 text-slate-100"><div>Hospital,Hospital City,Country,Billing Amount</div><div>Hart LLC,Delhi,India,25339</div><div>Murray-Shelton,Mumbai,India,34120</div></div></motion.section>;
}

function Stat({ title, value, subtitle, muted = false }: { title: string; value: string; subtitle: string; muted?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p><p className={`mt-1 text-2xl font-black ${muted ? "text-emerald-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{value}</span></div>;
}
