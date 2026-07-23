import { mlClient } from '../services/ml/ml-client.js';
import { getDatasetMetadataById, getDatasetRowsById } from '../services/ml/dataset-adapter.js';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function audit(agent, model, action, status = 'success', details = {}) {
  return {
    agent,
    model,
    action,
    status,
    details,
    timestamp: new Date().toISOString(),
  };
}

function createDashboardPlan(profile = {}, correlations = {}, anomalies = {}) {
  const measures = profile.measures || Object.keys(profile.numericSummary || {});
  const dimensions = profile.dimensions || [];
  const charts = [];

  if (measures.length) {
    charts.push({
      type: 'kpi',
      title: `Average ${measures[0]}`,
      measure: measures[0],
      aggregation: 'mean',
    });
  }

  if (dimensions.length && measures.length) {
    charts.push({
      type: 'bar',
      title: `${measures[0]} by ${dimensions[0]}`,
      x: dimensions[0],
      y: measures[0],
      aggregation: 'mean',
    });
  }

  if (measures.length >= 2) {
    charts.push({
      type: 'scatter',
      title: `${measures[0]} vs ${measures[1]}`,
      x: measures[0],
      y: measures[1],
    });
  }

  return {
    valid: true,
    charts,
    warnings: [
      ...(correlations?.strongPairs?.length ? [] : ['No strong numeric correlations found.']),
      ...(anomalies?.summary?.count || anomalies?.summary?.anomalyCount
        ? [`${anomalies.summary.count || anomalies.summary.anomalyCount} anomalies detected.`]
        : []),
    ],
  };
}

export async function handleAgenticDataScienceRoutes(request, response, pathname) {
  try {
    const match = pathname.match(/^\/api\/agentic-ds\/datasets\/([^/]+)\/full-analysis$/);
    if (request.method !== 'POST' || !match) return false;

    const datasetId = decodeURIComponent(match[1]);
    const body = await readJsonBody(request);
    const records = Array.isArray(body.records) || Array.isArray(body.rows)
      ? body.records || body.rows
      : await getDatasetRowsById(datasetId);
    const metadata = await getDatasetMetadataById(datasetId);
    const target = body.target;
    const auditTrail = [];

    auditTrail.push(audit('Schema Agent', process.env.AGENTIC_SCHEMA_MODEL || 'deterministic-python', 'profile dataset'));
    const profile = await mlClient.profile(records, { datasetId });

    auditTrail.push(audit('Analytics Tool Agent', 'python-fastapi', 'calculate correlations'));
    const correlations = await mlClient.correlations(records);

    auditTrail.push(audit('Analytics Tool Agent', 'python-fastapi', 'detect anomalies'));
    const anomalies = await mlClient.anomalies(records);

    let featureImportance = null;
    let model = null;
    const profileMeasures = profile.measures || Object.keys(profile.numericSummary || {});
    const profileDimensions = profile.dimensions || [];
    const targetExists = [...profileMeasures, ...profileDimensions, ...(profile.columns || []).map((column) => column.name)].includes(target);

    if (target && targetExists) {
      auditTrail.push(audit('ML Agent', 'scikit-learn', `train model for target ${target}`));
      featureImportance = await mlClient.featureImportance(records, target);
      model = await mlClient.trainModel(records, target);
    }

    auditTrail.push(audit('RAG Memory Agent', process.env.AGENTIC_EMBED_MODEL || 'nomic-embed-text:latest', 'generate future RAG/fine-tune records'));
    const trainingMemory = await mlClient.ragTrainingRecords(records, {
      dataset_name: body.datasetName || metadata.name || datasetId,
      goal: body.goal || 'agentic analytics',
      max_examples: 50,
    });

    auditTrail.push(audit('Dashboard Guardian', process.env.AGENTIC_GUARDIAN_MODEL || 'deterministic-validator', 'validate analytics output'));
    const dashboardPlan = createDashboardPlan(profile, correlations, anomalies);

    auditTrail.push(audit('Final Explanation Agent', process.env.AGENTIC_GENERAL_MODEL || 'local-summary', 'summarize deterministic outputs'));

    sendJson(response, 200, {
      ok: true,
      datasetId,
      type: 'agentic-data-science-analysis',
      auditTrail,
      result: {
        metadata,
        profile,
        correlations,
        anomalies,
        featureImportance,
        model,
        dashboardPlan,
        trainingMemory,
      },
    });
    return true;
  } catch (error) {
    sendJson(response, error.statusCode || error.status || 500, {
      ok: false,
      error: error.message || 'Agentic DS analysis failed',
    });
    return true;
  }
}
