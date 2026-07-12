export function runInsightAgent({ schemaProfile, semanticProfile, kpis, charts, geo }) {
  const insights = [
    {
      id: "schema-coverage",
      title: "Schema coverage",
      message: `${schemaProfile.columnCount || 0} columns were profiled into ${(semanticProfile.numericColumns || []).length} measures and ${(semanticProfile.categoricalColumns || []).length} dimensions.`,
      confidence: 0.9,
    },
  ];

  if (kpis?.length) {
    insights.push({
      id: "kpi-selection",
      title: "KPI selection",
      message: `${kpis.length} KPI specs were selected from grounded schema fields.`,
      confidence: 0.86,
    });
  }

  if (charts?.some((chart) => chart.intent === "correlation")) {
    insights.push({
      id: "correlation-ready",
      title: "Correlation ready",
      message: "Multiple numeric measures support correlation analysis.",
      confidence: 0.82,
    });
  }

  if (geo?.enabled) {
    insights.push({
      id: "geo-ready",
      title: "Geographic analysis ready",
      message: `Map analysis is enabled using ${geo.geoColumns[0]}.`,
      confidence: 0.88,
    });
  }

  return insights;
}
