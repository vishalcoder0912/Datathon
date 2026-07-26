// Main route aggregator
import { handleDatasetRoutes } from './datasets.js';
import { handleChatRoutes } from './chat.js';
import { handleAnalyticsRoutes } from './analytics.js';
import { handleAnalyticsBrainRoutes } from './analytics-brain.js';
import { handleAIRoutes } from './ai.js';
import { handleHealthRoutes } from './health.js';
import { handleExportRoutes } from './export.js';
import { handleMLRoutes } from './machine-learning.js';
import { handleStateRoutes } from './state.js';
import { handleQrUploadRoutes } from './qr-upload.js';
import { handlePlaybookAnalysisRoutes } from './playbook-analysis.js';
import { handlePdfRoutes } from './pdf.js';
import { handleAiAnalystRoutes } from './ai-analyst.routes.js';
import { handleSchemaTrainedAIRoutes } from './schema-trained-ai.routes.js';
import { handleDashboardQualityRoutes } from './dashboard-quality.js';
import { handleDashboardAiRoutes } from './dashboardAiRoutes.js';
import {
  handleChartQueryRequest,
  handleRemoveChartRequest,
} from './dashboard-chart-handler.js';
import { handleAgenticModelRoutes } from './agentic-models.js';
import { handleAgenticRoutes } from './agentic.js';
import {
  handleE2ECompatRoutes,
  handleE2ENotFound,
} from './e2e-compat.routes.js';
import { sendError, sendSuccess, sendJson } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

export async function setupRoutes(request, response) {
  const { method, pathname } = request;

  try {
    if (await handleE2ECompatRoutes(request, response, pathname)) {
      return;
    }

    // State routes (for frontend state management)
    if (await handleStateRoutes(request, response, pathname)) {
      return;
    }

    // Health check routes (highest priority)
    if (await handleHealthRoutes(request, response, pathname)) {
      return;
    }

    // Model-aware agentic routes before older AI/dashboard handlers
    if (await handleAgenticModelRoutes(request, response, pathname)) {
      return;
    }

    // Canonical schema-first agentic dataset routes
    if (await handleAgenticRoutes(request, response, pathname)) {
      return;
    }

    // Schema-trained dashboard/chat/RAG routes before legacy dashboard/chat handlers
    if (await handleSchemaTrainedAIRoutes(request, response, pathname)) {
      return;
    }

    // Dashboard quality validation routes
    if (await handleDashboardQualityRoutes(request, response, pathname)) {
      return;
    }

    // Schema-only AI dashboard planner + local analytics engine
    if (await handleDashboardAiRoutes(request, response, pathname)) {
      return;
    }

    // Dashboard-only chart command routes
    if (await handleChartQueryRequest(request, response, pathname)) {
      return;
    }
    if (await handleRemoveChartRequest(request, response, pathname)) {
      return;
    }

    // QR upload routes
    if (await handleQrUploadRoutes(request, response, pathname)) {
      return;
    }

    // AI provider routes
    if (await handleAIRoutes(request, response, pathname)) {
      return;
    }

    // PDF import and PDF Q&A routes
    if (await handlePdfRoutes(request, response, pathname)) {
      return;
    }

    // Dataset routes
    if (await handleDatasetRoutes(request, response, pathname)) {
      return;
    }

    // Chat routes
    if (await handleChatRoutes(request, response, pathname)) {
      return;
    }

    // Analytics routes
    if (await handleAnalyticsRoutes(request, response, pathname)) {
      return;
    }

    // DataAnalyticsProjects playbook route
    if (await handlePlaybookAnalysisRoutes(request, response, pathname)) {
      return;
    }

    // AI Analyst routes
    if (await handleAiAnalystRoutes(request, response, pathname)) {
      return;
    }

    // Schema-safe analytics brain routes
    if (await handleAnalyticsBrainRoutes(request, response, pathname)) {
      return;
    }

    // Export routes
    if (await handleExportRoutes(request, response, pathname)) {
      return;
    }

    // ML/AutoML routes
    if (await handleMLRoutes(request, response, pathname)) {
      return;
    }

    // Route not found
    if (method === 'GET' && pathname === '/') {
      // Root endpoint
      const rootData = {
        name: 'InsightFlow API',
        version: '2.0.0',
        description: 'AI-powered data analytics platform',
        endpoints: {
          health: '/api/health',
          ai: '/api/ai/*',
          datasets: '/api/datasets/*',
          chat: '/api/datasets/:id/chat',
          analytics: '/api/datasets/:id/analyze',
          export: '/api/datasets/:id/export'
        },
        documentation: '/api/docs',
        timestamp: new Date().toISOString()
      };
      sendJson(response, 200, rootData);
    } else {
      // 404 Not Found
      handleE2ENotFound(request, response);
    }

  } catch (error) {
    console.error('Route setup error:', error);
    sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error', 'ROUTE_ERROR');
  }
}

export default {
  setupRoutes
};
