/**
 * Dataset Routes
 * API endpoints for dataset operations
 */

import { randomUUID } from 'node:crypto';
import {
  createDataset,
  getDatasetById,
  getCurrentDataset,
  getDatabasePath,
  patchDatasetRow,
} from '../database/dataset-repository.js';
import { buildDatasetSchema, generateDemoDataset, normalizeColumns } from '../services/analytics-service.js';
import { validateRequired, validate } from '../middleware/validation.middleware.js';
import { AppError, NotFoundError } from '../middleware/error.middleware.js';
import logger from '../middleware/logger.middleware.js';

/**
 * Register dataset routes
 * @param {Object} server - HTTP server instance
 */
export function registerDatasetRoutes(server) {
  const sendJson = server._sendJson || ((res, status, payload) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(payload));
  });
  
  server.on('request', async (req, res) => {
    const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
    if (!url) return;
    
    const pathname = url.pathname;
    
    try {
      // GET /api/datasets/current - Get current active dataset
      if (req.method === 'GET' && pathname === '/api/datasets/current') {
        const dataset = getCurrentDataset();
        sendJson(res, 200, { 
          dataset: dataset ? {
            id: dataset.id,
            name: dataset.name,
            rowCount: dataset.rowCount,
            columnCount: dataset.columns.length,
          } : null 
        });
        return;
      }
      
      // GET /api/datasets/:id - Get dataset by ID
      const datasetMatch = pathname.match(/^\/api\/datasets\/([^/]+)$/);
      if (req.method === 'GET' && datasetMatch) {
        const [, datasetId] = datasetMatch;
        const dataset = getDatasetById(datasetId);
        
        if (!dataset) {
          throw new NotFoundError(`Dataset ${datasetId} not found`);
        }
        
        sendJson(res, 200, { dataset });
        return;
      }
      
      // POST /api/datasets/demo - Load demo dataset
      if (req.method === 'POST' && pathname === '/api/datasets/demo') {
        const demoDataset = generateDemoDataset();
        const dataset = createDataset({
          name: demoDataset.name,
          fileName: demoDataset.fileName,
          columns: demoDataset.columns,
          rows: demoDataset.rows,
          sourceType: demoDataset.sourceType,
        });
        
        logger.info('Demo dataset created', { datasetId: dataset.id });
        sendJson(res, 201, { dataset, chatMessages: [] });
        return;
      }
      
      // POST /api/datasets/import - Import dataset
      if (req.method === 'POST' && pathname === '/api/datasets/import') {
        const body = await readJsonBody(req);
        
        // Validate required fields
        validateRequired(body, ['rows']);
        
        if (!Array.isArray(body.rows) || body.rows.length === 0) {
          throw new AppError('Dataset must contain at least one row', 400, 'VALIDATION_ERROR');
        }
        
        const columns = normalizeColumns(
          body.rows, 
          Array.isArray(body.columns) ? body.columns : []
        );
        
        const dataset = createDataset({
          name: body.name || 'Uploaded Dataset',
          fileName: body.fileName || null,
          columns,
          rows: body.rows,
          sourceType: body.sourceType || 'upload',
        });
        
        logger.info('Dataset imported', { 
          datasetId: dataset.id, 
          rowCount: dataset.rowCount 
        });
        
        sendJson(res, 201, { dataset, chatMessages: [] });
        return;
      }
      
      // PATCH /api/datasets/:id/rows/:rowId - Update row
      const rowMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/rows\/([^/]+)$/);
      if (req.method === 'PATCH' && rowMatch) {
        const [, datasetId, rowId] = rowMatch;
        const body = await readJsonBody(req);
        
        validateRequired(body, ['column']);
        
        const dataset = patchDatasetRow({
          datasetId,
          rowId: Number(rowId),
          column: body.column,
          value: body.value,
        });
        
        if (!dataset) {
          throw new NotFoundError('Row not found');
        }
        
        sendJson(res, 200, { dataset });
        return;
      }
      
      // GET /api/datasets/:id/schema - Get dataset schema
      const schemaMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema$/);
      if (req.method === 'GET' && schemaMatch) {
        const [, datasetId] = schemaMatch;
        const dataset = getDatasetById(datasetId);
        
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        sendJson(res, 200, { schema: buildDatasetSchema(dataset) });
        return;
      }
      
    } catch (error) {
      // Error handling is done by server.js
      throw error;
    }
  });
  
  logger.info('Dataset routes registered');
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 60 * 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

export default registerDatasetRoutes;