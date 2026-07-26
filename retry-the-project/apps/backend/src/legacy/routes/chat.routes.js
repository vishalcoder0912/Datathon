/**
 * Chat Routes
 * API endpoints for AI chat functionality
 * Privacy-first: Only schema metadata is sent to AI, never raw data
 */

import { randomUUID } from 'node:crypto';
import { getDatasetById, saveChatMessages, getChatMessages } from '../database/dataset-repository.js';
import { createSchemaFirstChatResponse } from '../services/analytics-service.js';
import { validateRequired } from '../middleware/validation.middleware.js';
import { NotFoundError, AppError } from '../middleware/error.middleware.js';
import logger from '../middleware/logger.middleware.js';

/**
 * Register chat routes
 * @param {Object} server - HTTP server instance
 */
export function registerChatRoutes(server) {
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
      // POST /api/datasets/:id/chat - Send chat message
      const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);
      if (req.method === 'POST' && chatMatch) {
        const [, datasetId] = chatMatch;
        const body = await readJsonBody(req);
        
        // Validate required fields
        validateRequired(body, ['query']);
        
        const query = String(body.query).trim();
        if (!query) {
          throw new AppError('Query cannot be empty', 400, 'VALIDATION_ERROR');
        }
        
        // Extract user preferences (privacy-first - these are settings, not data)
        const preferences = {
          chartCount: body.chartCount || "auto",
          chartTypes: body.chartTypes || ["bar", "line", "pie"],
          showTrends: body.showTrends !== false,
          showCorrelations: body.showCorrelations !== false,
        };
        
        // Get dataset
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        logger.info('Processing chat query', { 
          datasetId, 
          query: query.substring(0, 50),
          preferences,
        });
        
        console.log('\n================================================');
        console.log('📥 API RECEIVED USER QUERY (Privacy-First):');
        console.log(`   Dataset ID: ${datasetId}`);
        console.log(`   Query: "${query}"`);
        console.log(`   Preferences: ${JSON.stringify(preferences)}`);
        console.log('================================================\n');
        
        // Get existing chat messages
        const existingMessages = getChatMessages(datasetId);
        
        // Process with AI using schema-first approach (no raw data sent)
        const analysis = await createSchemaFirstChatResponse(dataset, query, preferences);
        
        const now = new Date().toISOString();
        const userMessage = {
          id: randomUUID(),
          role: 'user',
          content: query,
          timestamp: now,
        };
        
        const assistantMessage = {
          id: randomUUID(),
          role: 'assistant',
          content: analysis.content,
          sql: analysis.sql,
          chart: analysis.chart,
          insights: analysis.insights,
          timestamp: now,
          usedAI: analysis.usedAI,
          model: analysis.model,
          confidence: analysis.confidence,
          intent: analysis.intent,
          reason: analysis.reason,
          metadata: {
            ...analysis.metadata,
            privacyMode: "schema-only",
          },
        };
        
        // Save messages
        saveChatMessages(datasetId, [userMessage, assistantMessage]);
        
logger.info('Chat response generated', {
          datasetId,
          usedAI: analysis.usedAI,
          model: analysis.model,
          confidence: analysis.confidence,
        });

        console.log('\n================================================');
        console.log('📤 API SENDING RESPONSE BACK:');
        console.log(`   Privacy Mode: Schema-Only (no raw data)`);
        console.log(`   Used AI: ${analysis.usedAI ? 'Yes 🤖' : 'No (Local)'}`);
        console.log(`   Model: ${analysis.model || 'Local Analysis Engine'}`);
        console.log(`   Confidence: ${(analysis.confidence || 0) * 100}%`);
        console.log(`   Intent: ${analysis.intent || 'N/A'}`);
        console.log(`   Response: ${analysis.content?.substring(0, 200)}...`);
        console.log('================================================\n');

        sendJson(res, 201, { 
          userMessage, 
          assistantMessage,
          chatHistory: [...existingMessages, userMessage, assistantMessage],
        });
        return;
      }
      
      // GET /api/datasets/:id/chat - Get chat history
      const historyMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);
      if (req.method === 'GET' && historyMatch) {
        const [, datasetId] = historyMatch;
        
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          throw new NotFoundError('Dataset not found');
        }
        
        const messages = getChatMessages(datasetId);
        sendJson(res, 200, { messages });
        return;
      }
      
    } catch (error) {
      throw error;
    }
  });
  
  logger.info('Chat routes registered (privacy-first mode)');
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

export default registerChatRoutes;
