export function executeKpiAgent(dashboardSpec, ontologyMapping) {
  // Augment existing KPIs based on ontology mapping
  const kpis = [...(dashboardSpec.kpis || [])];

  // If the ontology detected revenue but there's no revenue KPI, add a placeholder
  if (ontologyMapping.canonicalTerms.includes('revenue') && !kpis.some(k => k.title.toLowerCase().includes('revenue'))) {
    kpis.push({
      title: 'Total Revenue',
      priority: 1,
      aggregation: 'sum',
      reason: 'KPI Agent added this because revenue-related columns were semantically detected.'
    });
  }

  // If ontology detected churn, ensure it exists
  if (ontologyMapping.canonicalTerms.includes('churn') && !kpis.some(k => k.title.toLowerCase().includes('churn'))) {
    kpis.push({
      title: 'Overall Churn Rate',
      priority: 1,
      aggregation: 'avg',
      reason: 'KPI Agent flagged this as critical based on CRM ontology mapping.'
    });
  }

  return { ...dashboardSpec, kpis };
}
