export function executeChartAgent(dashboardSpec, ontologyMapping) {
  // Ensure we have charts appropriate for the mapped semantic concepts
  const charts = [...(dashboardSpec.charts || [])];

  if (ontologyMapping.canonicalTerms.includes('date') && !charts.some(c => c.type === 'line')) {
    charts.push({
      id: 'agentic_trend_chart',
      title: 'Performance Trend Over Time',
      type: 'line',
      priority: 'high',
      reason: 'Chart Agent enforced a line chart due to semantic detection of time-series data.'
    });
  }

  if (ontologyMapping.canonicalTerms.includes('region') && !charts.some(c => c.type === 'geo')) {
    charts.push({
      id: 'agentic_geo_map',
      title: 'Global Distribution Map',
      type: 'geo',
      priority: 'high',
      reason: 'Chart Agent enforced a geo map due to semantic detection of geographic dimensions.'
    });
  }

  return { ...dashboardSpec, charts };
}
