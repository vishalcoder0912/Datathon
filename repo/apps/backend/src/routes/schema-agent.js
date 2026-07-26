import { profileRows } from '../services/schema-agent/schema-profiler.js';
import { buildDashboardSpec } from '../services/schema-agent/dashboard-planner.js';
import { calculateDashboard } from '../services/schema-agent/dashboard-calculator.js';
import { buildTrainingExamples } from '../services/schema-agent/training-example-builder.js';
import { rememberSchema, findSimilarSchemas, memoryStats } from '../services/schema-agent/schema-memory-store.js';
import { validateDashboardSpec } from '../services/schema-agent/dashboard-guardian.js';
import { getDatasetRowsById } from '../services/schema-agent/dataset-adapter.js';
import { buildAnalyticsAgentPlan } from '../services/agentic/analytics-agent-planner.js';
import { routeAnalyticsTools } from '../services/agentic/analytics-tool-router.js';
import { critiqueDashboard } from '../services/agentic/analytics-critic-agent.js';
import { runChiefAnalystOrchestrator } from '../services/agentic/chief-analyst-orchestrator.js';
import { generateUnifiedDashboard } from '../services/agentic-dashboard/unified-dashboard-orchestrator.js';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function matchDatasetPath(pathname, action) {
  const pattern = new RegExp(`^/api/schema-agent/datasets/([^/]+)/${action}$`);
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function handleSchemaAgentRoutes(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/schema-agent/memory/stats') {
    const stats = await memoryStats();
    sendJson(response, 200, { ok: true, stats });
    return true;
  }

  const trainDatasetId = matchDatasetPath(pathname, 'train-schema');
  if (request.method === 'POST' && trainDatasetId) {
    const rows = await getDatasetRowsById(trainDatasetId);
    const profile = profileRows(rows, {
      datasetId: trainDatasetId,
      datasetName: trainDatasetId,
    });

    const similarSchemas = await findSimilarSchemas(profile);
    const dashboardSpec = buildDashboardSpec(profile, { similarSchemas });
    const guardian = validateDashboardSpec(profile, dashboardSpec);
    const trainingExamples = buildTrainingExamples(profile, dashboardSpec);
    const memoryRecord = await rememberSchema(profile, dashboardSpec, trainingExamples);

    sendJson(response, 200, {
      ok: true,
      profile,
      similarSchemas: similarSchemas.map((s) => ({
        id: s.id,
        similarity: s.similarity,
        datasetName: s.datasetName,
        primaryTarget: s.primaryTarget,
      })),
      dashboardSpec,
      guardian,
      memoryRecordId: memoryRecord.id,
      trainingExamplesCount: trainingExamples.length,
      message: 'Schema trained and saved to memory.',
    });
    return true;
  }

  const specDatasetId = matchDatasetPath(pathname, 'dashboard-spec');
  if (request.method === 'POST' && specDatasetId) {
    const rows = await getDatasetRowsById(specDatasetId);
    const profile = profileRows(rows, {
      datasetId: specDatasetId,
      datasetName: specDatasetId,
    });

    const unified = await generateUnifiedDashboard(
      {
        id: specDatasetId,
        name: specDatasetId,
        rows,
        columns: profile.columns?.map((column) => ({ name: column.name, type: column.type, role: column.role })) || [],
      },
      { useRagEmbedding: false }
    );

    const similarSchemas = await findSimilarSchemas(profile);
    const baseDashboardSpec = unified.dashboard || buildDashboardSpec(profile, { similarSchemas });
    
    // Multi-Agent Orchestration Layer (Phase 2, 3, 8)
    const { dashboardSpec, ontologyMapping } = runChiefAnalystOrchestrator(profile, baseDashboardSpec);

    // Agentic Loop Integration
    const agentPlan = buildAnalyticsAgentPlan({ schemaProfile: profile, userGoal: "Generate actionable analytics dashboard" });
    const agentTools = routeAnalyticsTools(agentPlan);
    const critic = critiqueDashboard({ schemaProfile: profile, dashboardPlan: dashboardSpec });

    const guardian = validateDashboardSpec(profile, dashboardSpec);
    const calculatedDashboard = calculateDashboard(rows, profile, dashboardSpec);

    sendJson(response, 200, {
      ok: true,
      profile,
      agentPlan,
      agentTools,
      critic,
      ontologyMapping,
      dashboardSpec,
      guardian,
      calculatedDashboard,
      message: 'Dashboard spec generated and values calculated from real rows.',
    });
    return true;
  }

  return false;
}
