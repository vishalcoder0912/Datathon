const GEO_ROLES = ["geo_country", "geo_state", "geo_city", "geo_region", "geo_latitude", "geo_longitude", "location"];

const GEO_PRIORITY = [
  "country",
  "country_code",
  "state",
  "province",
  "region",
  "city",
  "territory",
  "market",
  "zone",
];

const METRIC_PRIORITY = [
  "revenue",
  "profit",
  "sales",
  "billing_amount",
  "salary_usd",
  "orders",
  "customers",
  "patients",
  "review_count",
  "rating",
  "risk_score",
  "amount",
  "price",
  "cost",
  "quantity",
];

const SUM_METRICS = new Set([
  "revenue",
  "profit",
  "sales",
  "orders",
  "customers",
  "patients",
  "review_count",
  "amount",
  "price",
  "cost",
  "quantity",
]);

const AVERAGE_METRICS = new Set(["billing_amount", "salary_usd", "rating", "risk_score"]);

const REJECTED_METRIC_TERMS = [
  "name",
  "reviewer_name",
  "customer_name",
  "patient_name",
  "doctor",
  "hospital",
  "email",
  "phone",
  "address",
  "profile_link",
  "link",
  "url",
  "title",
  "description",
  "text",
  "id",
];

const LOCATION_ALIASES = new Map([
  ["usa", "United States"],
  ["us", "United States"],
  ["u.s.a", "United States"],
  ["u.s.a.", "United States"],
  ["united states", "United States"],
  ["united states of america", "United States"],
  ["gb", "United Kingdom"],
  ["uk", "United Kingdom"],
  ["u.k.", "United Kingdom"],
  ["united kingdom", "United Kingdom"],
  ["in", "India"],
  ["india", "India"],
  ["ca", "Canada"],
  ["canada", "Canada"],
  ["au", "Australia"],
  ["australia", "Australia"],
  ["ie", "Ireland"],
  ["ireland", "Ireland"],
  ["de", "Germany"],
  ["germany", "Germany"],
  ["fr", "France"],
  ["france", "France"],
  ["jp", "Japan"],
  ["japan", "Japan"],
]);

function normalizedName(value = "") {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function compactName(value = "") {
  return normalizedName(value).replace(/_/g, "");
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/,/g, "");
  const match = text.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocation(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return LOCATION_ALIASES.get(key) || raw;
}

function isRejectedMetric(column = {}) {
  const name = normalizedName(column.name || column.normalizedName);
  return REJECTED_METRIC_TERMS.some((term) => name === term || name.includes(term));
}

function hasNumericValues(column = {}, rows = []) {
  if (["number", "integer", "float", "decimal", "currency"].includes(column.type)) return true;
  return rows.some((row) => toNumber(row[column.name]) !== null);
}

function findColumnByNormalized(columns = [], target) {
  return columns.find((column) => normalizedName(column.name || column.normalizedName) === target);
}

function detectGeo(columns = []) {
  const latitude = columns.find((column) => ["latitude", "lat"].includes(normalizedName(column.name || column.normalizedName)));
  const longitude = columns.find((column) => ["longitude", "long", "lng", "lon"].includes(normalizedName(column.name || column.normalizedName)));
  if (latitude && longitude) {
    return {
      geoColumn: latitude,
      longitudeColumn: longitude,
      geoLevel: "coordinates",
      mapType: "point_map",
    };
  }

  for (const priority of GEO_PRIORITY) {
    const exact = findColumnByNormalized(columns, priority);
    if (exact) {
      return {
        geoColumn: exact,
        longitudeColumn: null,
        geoLevel: priority,
        mapType: priority === "country" || priority === "country_code"
          ? "country_choropleth"
          : priority === "city"
            ? "city_marker_map"
            : "regional_choropleth",
      };
    }
  }

  const roleMatch = columns.find((column) => GEO_ROLES.includes(column.semanticRole || column.role));
  if (!roleMatch) return null;
  const role = roleMatch.semanticRole || roleMatch.role;
  return {
    geoColumn: roleMatch,
    longitudeColumn: null,
    geoLevel: role === "geo_country" ? "country" : role === "geo_city" ? "city" : "region",
    mapType: role === "geo_country" ? "country_choropleth" : role === "geo_city" ? "city_marker_map" : "regional_choropleth",
  };
}

function detectMetric(columns = [], rows = []) {
  const candidates = columns.filter((column) => !isRejectedMetric(column));

  for (const priority of METRIC_PRIORITY) {
    const match = candidates.find((column) => {
      const name = normalizedName(column.name || column.normalizedName);
      return name === priority || name.includes(priority) || compactName(name).includes(compactName(priority));
    });
    if (match && hasNumericValues(match, rows)) {
      return {
        column: match,
        aggregation: AVERAGE_METRICS.has(priority) ? "average" : SUM_METRICS.has(priority) ? "sum" : "sum",
      };
    }
  }

  const numeric = candidates.find((column) =>
    String(column.semanticRole || column.role || "").includes("metric") ||
    hasNumericValues(column, rows)
  );

  return numeric ? { column: numeric, aggregation: "sum" } : { column: { name: "__count__" }, aggregation: "count" };
}

function buildLocationTooltips({ rows = [], geoKey, metric, aggregation }) {
  if (!geoKey || !Array.isArray(rows) || !rows.length) return [];
  const groups = new Map();

  for (const row of rows) {
    const location = normalizeLocation(row[geoKey]);
    if (!location) continue;
    if (!groups.has(location)) groups.set(location, []);
    groups.get(location).push(row);
  }

  return [...groups.entries()]
    .map(([location, group]) => {
      const values = group.map((row) => toNumber(row[metric])).filter((value) => value !== null);
      const mainKpi = metric === "__count__" || !values.length
        ? group.length
        : aggregation === "average" || aggregation === "avg"
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : values.reduce((sum, value) => sum + value, 0);
      return {
        location,
        mainKpi,
        records: group.length,
        insight: "",
      };
    })
    .sort((left, right) => Number(right.mainKpi) - Number(left.mainKpi))
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      insight: index === 0 ? "Highest ranked location for the selected KPI." : "Ranked by the selected KPI.",
    }));
}

export function runGeoAgent({ schemaProfile, semanticProfile }) {
  const columns = semanticProfile?.columns || schemaProfile.columns || [];
  const rows = schemaProfile.rows || [];
  const geo = detectGeo(columns);
  const metric = detectMetric(columns, rows);
  const rejectedColumns = columns.filter(isRejectedMetric).map((column) => column.name);

  if (!geo) {
    return {
      enabled: false,
      reason: "No geographic column detected.",
      maps: [],
    };
  }

  const selectedMetric = metric.column.name;
  const usedColumns = [geo.geoColumn.name, selectedMetric]
    .concat(geo.longitudeColumn ? [geo.longitudeColumn.name] : [])
    .filter((value, index, values) => value !== "__count__" && values.indexOf(value) === index);

  return {
    enabled: true,
    valid: true,
    intent: "fix_or_generate_geo_intelligence",
    dataset_name: schemaProfile.datasetName,
    geo_field: geo.geoColumn.name,
    geo_level: geo.geoLevel,
    selected_metric: selectedMetric,
    metric_type: selectedMetric === "__count__" ? "count" : "numeric",
    aggregation: metric.aggregation,
    used_columns: usedColumns,
    rejected_columns: rejectedColumns,
    cleaning_rules: [
      "extract_number_from_numeric_text",
      "group_null_unknown_invalid_locations_as_unknown",
      "do_not_highlight_unknown_locations",
    ],
    normalization_rules: [
      "US/USA/U.S.A./United States -> United States",
      "GB/UK/United Kingdom -> United Kingdom",
      "IN/India -> India",
      "CA/Canada -> Canada",
      "AU/Australia -> Australia",
      "IE/Ireland -> Ireland",
      "DE/Germany -> Germany",
      "FR/France -> France",
      "JP/Japan -> Japan",
    ],
    highlight_rule: "highlight_only_dataset_locations",
    glow_rule: {
      high: "top_20_percent_by_selected_metric",
      medium: "middle_40_percent_by_selected_metric",
      low: "bottom_40_percent_by_selected_metric",
      none: "not_present_or_invalid_location",
    },
    tooltip_fields: [
      "Location name",
      "Selected metric value",
      "Record count",
      "Rank",
      "AI Geo Insight",
    ],
    top_locations_rule: "rank_by_selected_numeric_metric_desc",
    unknown_location_rule: "group_as_unknown_and_do_not_highlight",
    map_type: geo.mapType,
    insight_template: `Geo activity is strongest in {{top_location}} based on ${selectedMetric}.`,
    reason: "Geo Intelligence generated from available schema fields only.",
    geoColumns: geo.longitudeColumn ? [geo.geoColumn.name, geo.longitudeColumn.name] : [geo.geoColumn.name],
    metricColumn: selectedMetric,
    normalization: {
      USA: "United States",
      US: "United States",
      "U.S.A": "United States",
    },
    tooltips: buildLocationTooltips({
      rows,
      geoKey: geo.geoColumn.name,
      metric: selectedMetric,
      aggregation: metric.aggregation,
    }),
    maps: [
      {
        type: geo.mapType,
        geoKey: geo.geoColumn.name,
        longitudeKey: geo.longitudeColumn?.name || null,
        metric: selectedMetric,
        aggregation: metric.aggregation,
      },
    ],
  };
}
