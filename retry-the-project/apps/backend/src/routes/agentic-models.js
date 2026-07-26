import { publicModelConfig } from '../config/agentic-models.js';
import { OLLAMA_AGENT_MODELS } from '../config/ollama-agent-models.js';
import { pingOllamaModels } from '../services/agentic/ollama-agent-router.js';
import {
  runModelAwareAgenticAnalysis,
  runModelAwareAgenticChat,
} from '../services/agentic/model-aware-agentic-orchestrator.js';
import { buildSchemaPacket, buildSchemaPacketV2 } from '../services/schema-packet-builder.js';
import { validateDashboardActions, assessDashboardHealth } from '../services/guardian/dashboard-guardian.js';
import { calculateDashboardData } from '../services/analytics/local-calculation-engine.js';
import { buildAnalystPrompt } from '../services/agentic/ai-analyst-prompts.js';
import { getDatasetById } from '../database/dataset-repository.js';
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

async function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;

  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 10_000_000) {
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on('error', reject);
  });
}

function datasetIdFromPath(pathname, suffix) {
  const prefix = '/api/agentic-models/datasets/';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  return pathname.slice(prefix.length, pathname.length - suffix.length).replace(/^\/+|\/+$/g, '');
}

async function loadDatasetOrThrow(datasetId) {
  let dataset = getDatasetById(datasetId);
  if (!dataset && globalThis.__INSIGHTFLOW_E2E_STORE__?.datasets) {
    dataset = globalThis.__INSIGHTFLOW_E2E_STORE__.datasets.get(datasetId);
  }
  if (!dataset) {
    const err = new Error(`Dataset not found: ${datasetId}`);
    err.statusCode = HTTP_STATUS.NOT_FOUND;
    throw err;
  }
  return dataset;
}

export async function handleAgenticModelRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname === '/api/agentic-models/config' && method === 'GET') {
    sendSuccess(response, publicModelConfig(), 'Agentic model config loaded');
    return true;
  }

  if (pathname === '/api/agentic-models/health' && method === 'GET') {
    const models = [...new Set(Object.values(OLLAMA_AGENT_MODELS))];
    const checks = await pingOllamaModels(models);
    sendSuccess(response, { checks }, 'Agentic model health checked');
    return true;
  }

  const analysisDatasetId = datasetIdFromPath(pathname, '/analyze');
  if (analysisDatasetId && method === 'POST') {
    try {
      const body = await parseJsonBody(request);
      const dataset = await loadDatasetOrThrow(analysisDatasetId);

      const schemaOnly = body.schema_only === true || process.env.AGENTIC_SCHEMA_ONLY_MODE === 'true';

      if (schemaOnly) {
        // SCHEMA-SAFE PATH: No raw rows sent to AI
        const schemaPacket = buildSchemaPacketV2(dataset, { sampleSize: body.sampleSize || 5000 });
        const currentDashboardState = body.currentDashboardState || {};

        // Build AI prompt with schema only
        const promptContext = buildAnalystPrompt(schemaPacket, body.goal || '', currentDashboardState);

        let aiResponse;
        try {
          aiResponse = await runModelAwareAgenticAnalysis({
            rows: [],
            columns: schemaPacket.columns || [],
            goal: body.goal || 'Create the best data analytics dashboard.',
            schemaPacket,
            promptContext,
          });
        } catch (aiError) {
          aiResponse = {
            response_type: 'dashboard_action',
            natural_response: `Analyzed "${schemaPacket.datasetName}" (${schemaPacket.rowCount} rows, ${schemaPacket.columnCount} columns, domain: ${schemaPacket.detectedDomain}). I'll create a dashboard based on the schema.`,
            actions: [],
          };
        }

        const aiActions = aiResponse.actions || aiResponse.dashboard?.actions || [];

        // Validate AI actions against schema
        const validationResult = validateDashboardActions(schemaPacket, currentDashboardState, aiActions);

        if (!validationResult.valid && validationResult.validatedActions.length === 0) {
          sendSuccess(response, {
            success: true,
            response_type: 'dashboard_action',
            natural_response: `I analyzed "${schemaPacket.datasetName}" but couldn't generate valid dashboard actions. ${validationResult.errors.map(e => e.suggestion).filter(Boolean).join('. ')}`,
            dataset_id: dataset.id,
            actions: [],
            computed_results: {},
            warnings: validationResult.warnings,
            errors: validationResult.errors,
            schema_safe: true,
            audit: {
              schemaColumnsReceived: schemaPacket.columns.length,
              rawRowsSent: 0,
              actionsValidated: 0,
              actionsRejected: validationResult.errors.length,
            },
          });
          return true;
        }

        // Calculate all values locally
        const computedResults = calculateDashboardData(dataset, validationResult.validatedActions);

        // Assess dashboard health
        const dashboardHealth = assessDashboardHealth(schemaPacket, {
          kpis: validationResult.validatedActions.filter(a => a.action === 'create_kpi'),
          charts: validationResult.validatedActions.filter(a => a.action === 'create_chart'),
        });

        sendSuccess(response, {
          success: true,
          response_type: 'dashboard_action',
          natural_response: aiResponse.natural_response || `Built a ${schemaPacket.detectedDomain} dashboard with ${validationResult.validatedActions.length} components.`,
          dataset_id: dataset.id,
          actions: validationResult.validatedActions,
          computed_results: computedResults,
          warnings: validationResult.warnings,
          errors: validationResult.errors,
          schema_safe: true,
          dashboard_health: dashboardHealth,
          audit: {
            schemaColumnsReceived: schemaPacket.columns.length,
            rawRowsSent: 0,
            actionsValidated: validationResult.validatedActions.length,
            actionsRejected: validationResult.errors.length,
          },
        }, 'Schema-safe agentic analysis complete');
        return true;
      }

      // LEGACY PATH: With full data (existing behavior)
      const result = await runModelAwareAgenticAnalysis({
        rows: dataset.rows || [],
        columns: dataset.columns || [],
        goal: body.goal || 'Create the best data analytics dashboard.',
      });
      sendSuccess(response, result, 'Model-aware agentic analysis complete');
      return true;
    } catch (error) {
      sendError(
        response,
        error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Agentic analysis failed',
        'AGENTIC_ANALYSIS_ERROR',
      );
      return true;
    }
  }

  const chatDatasetId = datasetIdFromPath(pathname, '/chat');
  if (chatDatasetId && method === 'POST') {
    try {
      const body = await parseJsonBody(request);
      const dataset = await loadDatasetOrThrow(chatDatasetId);
      const result = await runModelAwareAgenticChat({
        rows: dataset.rows || [],
        columns: dataset.columns || [],
        message: body.message || body.query || '',
        history: body.history || [],
      });
      sendSuccess(response, result, 'Model-aware agentic chat complete');
      return true;
    } catch (error) {
      sendError(
        response,
        error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Agentic chat failed',
        'AGENTIC_CHAT_ERROR',
      );
      return true;
    }
  }

  return false;
}
