// AI provider routes and status
import QRCode from 'qrcode';
import { serviceUrls } from "../config/serviceUrls.js";
import { OLLAMA_HOST, getModelForTask, getConfiguredModels } from "../config/model-router.js";
import { aiManager } from '../services/ai/ai-manager.js';
import { getOllamaStatus } from '../services/ollama/ollama-dual-model-service.js';
import {
  createQrUploadSession,
  verifyQrUploadSession,
} from '../services/qr-upload/qr-upload-store.js';
import { sendJson, sendSuccess, sendError, sendAIStatus } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { ValidationError } from '../middleware/error-handler.js';

export async function handleAIRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/ai/providers/health - Unified health check
  if (pathname === '/api/ai/providers/health' && method === 'GET') {
    try {
      const { providerHealthService } = await import('../services/ai-providers/provider-health-service.js');
      const health = await providerHealthService.checkHealth();
      sendJson(response, 200, health);
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message, ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/ai/ollama/health - Ollama health check with model availability
  if (pathname === '/api/ai/ollama/health' && method === 'GET') {
    try {
      const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!ollamaResponse.ok) {
        sendJson(response, 200, {
          success: false,
          ollama_running: false,
          host: OLLAMA_HOST,
          models: {},
          configured_models: getConfiguredModels(),
          missing_models: Object.values(getConfiguredModels()),
          install_commands: [
            'ollama pull qwen3:8b',
            'ollama pull qwen3:4b',
            'ollama pull qwen2.5-coder:7b',
            'ollama pull llama3.2:3b',
            'ollama pull nomic-embed-text',
          ],
        });
        return true;
      }

      const payload = await ollamaResponse.json();
      const installedModels = (payload.models || []).map((m) => m.name);

      const requiredModels = [
        'qwen3:8b',
        'qwen3:4b',
        'qwen2.5-coder:7b',
        'llama3.2:3b',
        'nomic-embed-text',
      ];

      const modelStatus = {};
      const missingModels = [];

      for (const model of requiredModels) {
        const found = installedModels.some((installed) => {
          const installedBase = installed.split(':')[0];
          const modelBase = model.split(':')[0];
          const modelTag = model.split(':')[1] || 'latest';
          const installedTag = installed.split(':')[1] || 'latest';
          return installedBase === modelBase && installedTag === modelTag;
        });
        modelStatus[model] = found;
        if (!found) missingModels.push(model);
      }

      const allPresent = missingModels.length === 0;

      sendJson(response, 200, {
        success: allPresent,
        ollama_running: true,
        host: OLLAMA_HOST,
        models: modelStatus,
        configured_models: getConfiguredModels(),
        ...(allPresent
          ? {}
          : {
              missing_models: missingModels,
              install_commands: missingModels.map((m) => `ollama pull ${m}`),
            }),
      });

      return true;
    } catch (error) {
      sendJson(response, 200, {
        success: false,
        ollama_running: false,
        host: OLLAMA_HOST,
        models: {},
        configured_models: getConfiguredModels(),
        missing_models: Object.values(getConfiguredModels()),
        install_commands: [
          'ollama pull qwen3:8b',
          'ollama pull qwen3:4b',
          'ollama pull qwen2.5-coder:7b',
          'ollama pull llama3.2:3b',
          'ollama pull nomic-embed-text',
        ],
        error: error.message,
      });
      return true;
    }
  }

  // GET /api/ai/ollama-status - Get dual Ollama model status
  if (pathname === '/api/ai/ollama-status' && method === 'GET') {
    try {
      const status = await getOllamaStatus();

      sendSuccess(
        response,
        {
          ollama: status,
          usage: {
            dashboardChatbot: status.dashboardModel,
            aiChat: status.chatModel,
          },
        },
        'Ollama dual-model status',
      );

      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to get Ollama status',
        ERROR_CODES.AI_GENERATION_FAILED,
      );

      return true;
    }
  }

  // GET /api/ai/status - Get AI provider status
  if (pathname === '/api/ai/status' && method === 'GET') {
    try {
      const health = await aiManager.health();
      sendAIStatus(response, Object.values(health.providers));
      return true;
    } catch (error) {
      console.error('AI status error:', error);
      sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to get AI status', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      return true;
    }
  }

  // GET /api/ai/providers - Get available AI providers
  if (pathname === '/api/ai/providers' && method === 'GET') {
    try {
      const providers = await aiManager.getAvailableProviders();
      sendSuccess(response, providers, 'Available AI providers');
      return true;
    } catch (error) {
      console.error('AI providers error:', error);
      sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to get AI providers', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      return true;
    }
  }

  // GET /api/ai/stats - Get AI usage statistics
  if (pathname === '/api/ai/stats' && method === 'GET') {
    try {
      const stats = aiManager.getStats();
      sendSuccess(response, stats, 'AI usage statistics');
      return true;
    } catch (error) {
      console.error('AI stats error:', error);
      sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to get AI stats', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      return true;
    }
  }

  // POST /api/ai/test - Test AI generation
  if (pathname === '/api/ai/test' && method === 'POST') {
    try {
      // Parse request body
      const body = await parseRequestBody(request);
      
      // Validate input
      const { prompt, provider, options = {} } = body;
      if (!prompt || typeof prompt !== 'string') {
        throw new ValidationError('Prompt is required and must be a string');
      }

      if (prompt.length > 10000) {
        throw new ValidationError('Prompt too long (max 10000 characters)');
      }

      // Set preferred provider if specified
      if (provider && typeof provider === 'string') {
        options.preferredProvider = provider;
      }

      console.log(`🧪 Testing AI with prompt: "${prompt.substring(0, 50)}..."`);
      
      // Generate response
      const result = await aiManager.generateResponse(prompt, options);
      
      if (result.success) {
        sendSuccess(response, {
          prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
          response: result.content,
          provider: result.provider,
          model: result.model,
          duration: result.duration,
          tokens: result.tokens,
          fallback: result.fallback || false
        }, 'AI test successful');
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, result.error || 'AI generation failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      
      return true;
    } catch (error) {
      console.error('AI test error:', error);
      
      if (error instanceof ValidationError) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, error.message, ERROR_CODES.VALIDATION_ERROR);
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI test failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      return true;
    }
  }

  // POST /api/ai/chat - Test AI chat
  if (pathname === '/api/ai/chat' && method === 'POST') {
    try {
      // Parse request body
      const body = await parseRequestBody(request);
      
      // Validate input
      const { messages, provider, options = {} } = body;
      if (!messages || !Array.isArray(messages)) {
        throw new ValidationError('Messages array is required');
      }

      if (messages.length === 0) {
        throw new ValidationError('At least one message is required');
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content) {
          throw new ValidationError('Each message must have role and content');
        }
        if (!['user', 'assistant', 'system'].includes(msg.role)) {
          throw new ValidationError('Invalid message role');
        }
      }

      // Set preferred provider if specified
      if (provider && typeof provider === 'string') {
        options.preferredProvider = provider;
      }

      console.log(`🧪 Testing AI chat with ${messages.length} messages`);
      
      // Generate chat response
      const result = await aiManager.chat(messages, options);
      
      if (result.success) {
        sendSuccess(response, {
          messages: messages.map(m => ({
            role: m.role,
            content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
          })),
          response: result.content,
          provider: result.provider,
          model: result.model,
          duration: result.duration,
          fallback: result.fallback || false
        }, 'AI chat test successful');
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, result.error || 'AI chat failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      
      return true;
    } catch (error) {
      console.error('AI chat test error:', error);
      
      if (error instanceof ValidationError) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, error.message, ERROR_CODES.VALIDATION_ERROR);
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI chat test failed', ERROR_CODES.AI_GENERATION_FAILED);
      }
      return true;
    }
  }

  // POST /api/ai/switch - Switch active AI provider
  if (pathname === '/api/ai/switch' && method === 'POST') {
    try {
      // Parse request body
      const body = await parseRequestBody(request);
      
      // Validate input
      const { provider } = body;
      if (!provider || typeof provider !== 'string') {
        throw new ValidationError('Provider name is required');
      }

      console.log(`🔄 Switching to AI provider: ${provider}`);
      
      // Switch provider
      await aiManager.switchProvider(provider);
      
      sendSuccess(response, {
        activeProvider: provider,
        timestamp: new Date().toISOString()
      }, `Switched to ${provider}`);
      
      return true;
    } catch (error) {
      console.error('AI switch error:', error);
      
      if (error instanceof ValidationError) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, error.message, ERROR_CODES.VALIDATION_ERROR);
      } else {
        sendError(response, HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to switch AI provider', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
      }
      return true;
    }
  }

  // POST /api/ai/reset-stats - Reset AI statistics
  if (pathname === '/api/ai/reset-stats' && method === 'POST') {
    try {
      aiManager.resetStats();
      sendSuccess(response, {
        message: 'AI statistics reset',
        timestamp: new Date().toISOString()
      }, 'AI statistics reset successfully');
      return true;
    } catch (error) {
      console.error('AI reset stats error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to reset AI stats', ERROR_CODES.INTERNAL_SERVER_ERROR);
      return true;
    }
  }

  // GET /api/cascade/status - Get cascade status
  if (pathname === '/api/cascade/status' && method === 'GET') {
    try {
      const health = await aiManager.health();
      const cascade = {
        active: true,
        providers: Object.entries(health.providers).map(([name, provider]) => ({
          name,
          available: provider.available,
          priority: provider.priority || 0
        })).sort((a, b) => a.priority - b.priority),
        currentProvider: health.activeProvider || 'ollama',
        fallbackChain: ['ollama', 'gemini', 'openai', 'anthropic'],
        stats: aiManager.getStats()
      };
      
      sendSuccess(response, { cascade }, 'Cascade status retrieved');
      return true;
    } catch (error) {
      console.error('Cascade status error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get cascade status', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // POST /api/qr-upload/generate - Generate QR upload session
  if (pathname === '/api/qr-upload/generate' && method === 'POST') {
    try {
      const body = await parseRequestBody(request);
      const session = createQrUploadSession({
        portalBaseUrl:
          body.portalBaseUrl ||
          process.env.FRONTEND_PUBLIC_URL ||
          process.env.VITE_PUBLIC_APP_URL ||
          request.headers.origin ||
          getDefaultPortalBaseUrl(request),
        workspaceName: body.workspaceName || 'InsightFlow Workspace',
      });

      const qrDataUrl = await QRCode.toDataURL(session.uploadUrl, {
        margin: 1,
        width: 320,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });
      
      sendSuccess(response, {
        sessionId: session.sessionId,
        uploadToken: session.uploadToken,
        expiresAt: session.expiresAt,
        uploadUrl: session.uploadUrl,
        qrDataUrl,
        workspaceName: session.workspaceName,
        status: session.status,
      }, 'QR session generated');
      return true;
    } catch (error) {
      console.error('QR generate error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate QR session', ERROR_CODES.INTERNAL_SERVER_ERROR);
      return true;
    }
  }

  // GET /api/qr-upload/:sessionId/status - Get QR session status
  if (pathname.match(/^\/api\/qr-upload\/[^/]+\/status$/) && method === 'GET') {
    try {
      const parts = pathname.split('/');
      const sessionId = parts[3];
      const token = request.searchParams?.get('token') || new URL(request.url, `http://${request.headers.host}`).searchParams.get('token');

      const session = verifyQrUploadSession(sessionId, token);
      
      sendSuccess(response, {
        sessionId: session.sessionId,
        status: session.status,
        workspaceName: session.workspaceName,
        files: session.files,
        dataset: session.dataset,
        analysis: session.analysis,
        error: session.error,
        expiresAt: session.expiresAt,
      }, 'Session status retrieved');
      return true;
    } catch (error) {
      console.error('QR status error:', error);
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || 'Failed to get session status', ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  return false;
}

function getDefaultPortalBaseUrl(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  const host = request.headers.host || new URL(serviceUrls.api).host;

  if (host === new URL(serviceUrls.api).host) {
    return serviceUrls.frontend;
  }

  if (host === '127.0.0.1:3001') {
    return `${protocol}://127.0.0.1:5173`;
  }

  return `${protocol}://${host}`;
}

/**
 * Parse request body from stream
 */
async function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    request.on('data', chunk => {
      body += chunk.toString();
      
      // Prevent memory issues with large payloads
      if (body.length > 1024 * 1024) { // 1MB limit
        reject(new Error('Request body too large'));
        return;
      }
    });
    
    request.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    
    request.on('error', reject);
  });
}

export default {
  handleAIRoutes
};
