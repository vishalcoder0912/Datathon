/**
 * Health Check Routes
 * API endpoints for health monitoring
 */

import { getDatabasePath } from '../database/dataset-repository.js';
import { isGeminiConfigured } from '../services/gemini-ai-service.js';
import logger from '../middleware/logger.middleware.js';

/**
 * Register health routes
 * @param {Object} server - HTTP server instance
 */
export function registerHealthRoutes(server) {
  const sendJson = (res, status, payload) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(payload));
  };
  
  server.on('request', async (req, res) => {
    const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
    if (!url) return;
    
    const pathname = url.pathname;
    
    // GET /api/health - Health check
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
          path: getDatabasePath(),
        },
        services: {
          gemini: isGeminiConfigured() ? 'configured' : 'not_configured',
        },
      });
      return;
    }
    
    // GET /api/ready - Readiness check
    if (req.method === 'GET' && pathname === '/api/ready') {
      const ready = isGeminiConfigured();
      sendJson(res, ready ? 200 : 503, {
        ready,
        message: ready ? 'Service ready' : 'Service not ready',
        checks: {
          gemini: isGeminiConfigured(),
        },
      });
      return;
    }
  });
  
  logger.info('Health routes registered');
}

export default registerHealthRoutes;