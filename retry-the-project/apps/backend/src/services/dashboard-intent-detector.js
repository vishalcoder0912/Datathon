export function detectIntent(query = '') {
  const q = query.toLowerCase();
  
  if (/remove|delete|clear/.test(q) && /chart|graph|plot/.test(q)) {
    return 'remove_chart';
  }
  if (/clear|remove|reset/.test(q) && /filter/.test(q)) {
    return 'remove_filter';
  }
  if (/filter|where|show only|only show/.test(q)) {
    return 'add_filter';
  }
  if (/kpi|summary card|card|total records/.test(q)) {
    return 'create_kpi';
  }
  if (/build dashboard|create dashboard|setup dashboard|make dashboard/.test(q)) {
    return 'build_dashboard';
  }
  if (/insight|explain|describe/.test(q)) {
    return 'generate_insight';
  }
  if (/compare|versus|vs|against/.test(q)) {
    return 'compare';
  }
  if (/rank|top|bottom|highest|lowest/.test(q)) {
    return 'rank';
  }
  if (/distribution|spread|histogram|range/.test(q)) {
    return 'distribution';
  }
  if (/ratio|percentage|share|proportion|pie|donut/.test(q)) {
    return 'ratio';
  }
  if (/trend|over time|monthly|yearly|daily|trendline|date|line/.test(q)) {
    return 'trend';
  }
  
  return 'create_chart';
}

export function suggestChartType({ dimension, metric, metric2, query = '', intent = '' }) {
  const q = query.toLowerCase();
  
  // Specific overrides if user explicitly asks for a type:
  if (/pie|donut/.test(q)) return 'donut';
  if (/bar/.test(q)) return /horizontal/.test(q) ? 'horizontal_bar' : 'bar';
  if (/line|trend/.test(q)) return 'line';
  if (/scatter/.test(q)) return 'scatter';
  if (/histogram|distribution/.test(q)) return 'histogram';
  if (/geo|map|country|location/.test(q) && dimension && /country|state|city|region/i.test(dimension.name)) return 'geo_map';
  
  // Rule-based selection:
  if (dimension && /country|state|city|region/i.test(dimension.name)) {
    return 'geo_map';
  }
  
  if (dimension && dimension.role === 'date' && metric) {
    return 'line';
  }
  
  if (metric && metric2) {
    return 'scatter';
  }
  
  if (intent === 'distribution' || (metric && /distribution|histogram|range/i.test(q))) {
    return 'histogram';
  }
  
  if (intent === 'rank' || /top|bottom/i.test(q)) {
    return 'horizontal_bar';
  }
  
  if (dimension && metric) {
    return 'bar';
  }
  
  if (dimension && !metric) {
    return 'donut';
  }
  
  return 'bar';
}
