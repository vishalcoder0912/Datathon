/**
 * Analytics Routes
 * API endpoints for analytics functionality
 */

import { getDatasetById } from '../database/dataset-repository.js';
import { generateCorrelationAnalysis } from '../services/analytics-service.js';
import { NotFoundError } from '../middleware/error.middleware.js';
import logger from '../middleware/logger.middleware.js';

/**
 * Register analytics routes
 * @param {Object} server - HTTP server instance
 */
export function registerAnalyticsRoutes(server) {
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
    
    try {
      // GET /api/datasets/:id/ai-correlations - Get correlation analysis
      const corrMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai-correlations$/);
      if (req.method === 'GET' && corrMatch) {
        const [, datasetId] = corrMatch;
        
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        logger.info('Generating correlation analysis', { datasetId });
        
        const result = generateCorrelationAnalysis(dataset);
        
        sendJson(res, 200, result);
        return;
      }
      
      // GET /api/datasets/:id/stats - Get dataset statistics
      const statsMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/stats$/);
      if (req.method === 'GET' && statsMatch) {
        const [, datasetId] = statsMatch;
        
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        // Calculate basic statistics
        const stats = calculateDatasetStats(dataset);
        
        sendJson(res, 200, stats);
        return;
      }
      
    } catch (error) {
      throw error;
    }
  });
  
  logger.info('Analytics routes registered');
}

/**
 * Calculate basic dataset statistics
 */
function calculateDatasetStats(dataset) {
  const columns = dataset.columns || [];
  const rows = dataset.rows || [];
  
  const columnStats = columns.map(col => {
    const values = rows.map(r => r[col.name]).filter(v => v !== null && v !== undefined && v !== '');
    
    const stats = {
      name: col.name,
      type: col.type,
      count: values.length,
      nullCount: rows.length - values.length,
      uniqueCount: new Set(values).size,
    };
    
    if (col.type === 'number') {
      const nums = values.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        stats.min = Math.min(...nums);
        stats.max = Math.max(...nums);
        stats.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    } else {
      // For categorical, get top values
      const freq = {};
      values.forEach(v => freq[v] = (freq[v] || 0) + 1);
      stats.topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    }
    
    return stats;
  });
  
  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: columnStats,
  };
}

export default registerAnalyticsRoutes;