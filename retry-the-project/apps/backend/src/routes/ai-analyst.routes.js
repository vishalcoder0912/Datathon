import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import {
  runFullAutoAnalysis,
  runAnalystCommand,
} from '../services/ai-analyst/ai-analyst-orchestrator.js';
import { getDatasetById } from '../database/dataset-repository.js';

async function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

export async function handleAiAnalystRoutes(request, response, pathname) {
  const { method } = request;

  // POST /api/datasets/:id/ai-analyst/analyze
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai-analyst\/analyze$/) && method === 'POST') {
    try {
      const parts = pathname.split('/');
      const datasetId = parts[3];
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }

      const analysis = await runFullAutoAnalysis(dataset);

      sendSuccess(response, { analysis }, 'AI Analyst analysis complete');
      return true;
    } catch (error) {
      console.error('[AI-ANALYST] Analyze error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || 'Analysis failed', ERROR_CODES.INTERNAL_ERROR);
      return true;
    }
  }

  // POST /api/datasets/:id/ai-analyst/command
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai-analyst\/command$/) && method === 'POST') {
    try {
      const parts = pathname.split('/');
      const datasetId = parts[3];
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }

      const body = await getRequestBody(request);

      const result = await runAnalystCommand({
        dataset,
        currentAnalysis: body.currentAnalysis,
        command: body.command || body.query,
        filters: body.filters || {},
      });

      sendSuccess(response, { result }, 'AI Analyst command executed');
      return true;
    } catch (error) {
      console.error('[AI-ANALYST] Command error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || 'Command failed', ERROR_CODES.INTERNAL_ERROR);
      return true;
    }
  }

  return false;
}

export default {
  handleAiAnalystRoutes,
};
