import { mapSchemaToOntology } from '../ai-analyst/knowledge/ontology-mapper.js';
import { executeKpiAgent } from './kpi-agent.js';
import { executeChartAgent } from './chart-agent.js';
import { executeInsightAgent } from './insight-agent.js';
import { executeStorytellingAgent } from './storytelling-agent.js';

export function runChiefAnalystOrchestrator(profile, baseDashboardSpec) {
  // 1. Map Schema using Business Ontology
  const columnNames = profile.columns?.map(c => c.name) || [];
  const ontologyMapping = mapSchemaToOntology(columnNames);

  // 2. Wrap legacy spec
  let spec = { ...baseDashboardSpec };

  // 3. Delegate to KPI Agent
  spec = executeKpiAgent(spec, ontologyMapping);

  // 4. Delegate to Chart Agent
  spec = executeChartAgent(spec, ontologyMapping);

  // 5. Delegate to Insight Agent
  spec = executeInsightAgent(spec, ontologyMapping);

  // 6. Delegate to Storytelling Agent
  spec = executeStorytellingAgent(spec, ontologyMapping);

  return {
    dashboardSpec: spec,
    ontologyMapping
  };
}
