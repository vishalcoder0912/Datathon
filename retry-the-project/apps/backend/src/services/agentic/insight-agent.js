export function executeInsightAgent(dashboardSpec, ontologyMapping) {
  const insights = [...(dashboardSpec.insights || [])];

  if (ontologyMapping.inferredDomain !== 'generic') {
    insights.push({
      title: 'Domain Intelligently Detected',
      description: `Insight Agent confirms this dataset strongly aligns with the ${ontologyMapping.inferredDomain.toUpperCase()} domain based on semantic ontology.`,
      severity: 'info'
    });
  }

  return { ...dashboardSpec, insights };
}
