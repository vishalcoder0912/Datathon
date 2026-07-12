export function critiqueDashboard({ schemaProfile, dashboardPlan }) {
  const issues = [];
  const improvements = [];

  const columns = schemaProfile.columns || [];
  const kpis = dashboardPlan.kpis || [];
  const charts = dashboardPlan.charts || [];

  const hasMoney = columns.some((c) =>
    /revenue|sales|salary|amount|profit|cost|expense/i.test(c.name)
  );

  const hasDate = columns.some((c) =>
    /date|time|timestamp|month|year/i.test(c.name)
  );

  const hasGeo = columns.some((c) =>
    /country|state|city|region|location|latitude|longitude/i.test(c.name)
  );

  if (hasMoney && !kpis.some((k) => /revenue|sales|salary|profit|cost|amount/i.test(k.title))) {
    issues.push("Money metric exists but no strong financial KPI was selected.");
    improvements.push("Add revenue/profit/salary/cost KPI based on the detected metric.");
  }

  if (hasDate && !charts.some((c) => /line|area|trend/i.test(c.type + c.title))) {
    issues.push("Date column exists but no trend chart was generated.");
    improvements.push("Add a time-series line chart.");
  }

  if (hasGeo && !charts.some((c) => /geo|map/i.test(c.type + c.title))) {
    issues.push("Geo column exists but no map chart was generated.");
    improvements.push("Add global map or regional heatmap.");
  }

  if (charts.some((c) => /pie|donut/i.test(c.type) && /id|email|name/i.test(c.xKey || ""))) {
    issues.push("Pie/donut chart is using a high-cardinality identifier field.");
    improvements.push("Replace it with a ranking bar chart.");
  }

  return {
    score: Math.max(0, 100 - issues.length * 20),
    status: issues.length ? "needs_improvement" : "excellent",
    issues,
    improvements,
  };
}
