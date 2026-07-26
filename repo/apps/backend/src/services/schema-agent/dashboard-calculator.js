function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[$,₹,%]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupBy(rows, dimension, splitMultiValue = false, separator = ',') {
  const groups = new Map();

  for (const row of rows) {
    const raw = row[dimension];

    const keys = splitMultiValue && typeof raw === 'string'
      ? raw.split(separator).map((v) => v.trim()).filter(Boolean)
      : [String(raw ?? 'Unknown')];

    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }

  return groups;
}

function aggregate(rows, aggregation, column) {
  if (aggregation === 'count_rows' || aggregation === 'count') return rows.length;

  const values = rows.map((row) => numberValue(row[column])).filter((v) => v !== null);

  if (!values.length) return null;
  if (aggregation === 'sum') return values.reduce((a, b) => a + b, 0);
  if (aggregation === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (aggregation === 'min') return Math.min(...values);
  if (aggregation === 'max') return Math.max(...values);
  if (aggregation === 'median') return median(values);

  return null;
}

function calculateKpi(rows, profile, kpi) {
  const type = kpi.calculation.type;

  if (type === 'count_rows') return rows.length;
  if (type === 'quality_score') return profile.quality?.qualityScore ?? null;
  if (['sum', 'avg', 'min', 'max', 'median'].includes(type)) {
    return aggregate(rows, type, kpi.calculation.column);
  }

  return null;
}

function calculateChart(rows, chart) {
  const calc = chart.calculation;

  if (chart.type === 'histogram') {
    const values = rows.map((row) => numberValue(row[calc.dimension])).filter((v) => v !== null);
    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = calc.bins || 10;
    const width = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      label: `${Math.round(min + i * width)}-${Math.round(min + (i + 1) * width)}`,
      value: 0,
    }));

    for (const value of values) {
      const index = Math.min(Math.floor((value - min) / width), bins - 1);
      buckets[index].value += 1;
    }

    return buckets;
  }

  if (chart.type === 'scatter') {
    return rows.slice(0, 2000).map((row) => ({
      x: numberValue(row[calc.x]),
      y: numberValue(row[calc.y]),
    })).filter((point) => point.x !== null && point.y !== null);
  }

  if (calc.dimension) {
    const groups = groupBy(rows, calc.dimension, calc.splitMultiValue, calc.separator || ',');
    const data = Array.from(groups.entries()).map(([label, groupRows]) => ({
      label,
      value: aggregate(groupRows, calc.metric?.aggregation || 'count_rows', calc.metric?.column),
      count: groupRows.length,
    }));

    data.sort((a, b) => {
      if (calc.sort === 'asc') return (a.value ?? 0) - (b.value ?? 0);
      return (b.value ?? 0) - (a.value ?? 0);
    });

    return data.slice(0, calc.limit || 20);
  }

  return [];
}

export function calculateDashboard(rows, profile, dashboardSpec) {
  return {
    datasetId: profile.datasetId,
    calculatedAt: new Date().toISOString(),
    kpis: dashboardSpec.kpis.map((kpi) => ({
      ...kpi,
      value: calculateKpi(rows, profile, kpi),
    })),
    charts: dashboardSpec.charts.map((chart) => ({
      ...chart,
      data: calculateChart(rows, chart),
    })),
  };
}
