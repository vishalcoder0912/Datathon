// Response utility functions
import { gzipSync } from 'node:zlib';
import { CONTENT_TYPES } from '../config/constants.js';

/**
 * Send JSON response
 */
export function sendJson(response, statusCode, payload) {
  const jsonString = JSON.stringify(payload, null, 2);
  const acceptsGzip = String(response.req?.headers?.['accept-encoding'] || '').includes('gzip');
  const shouldCompress = acceptsGzip && Buffer.byteLength(jsonString, 'utf8') > 1024;
  const body = shouldCompress ? gzipSync(jsonString) : jsonString;
  
  const headers = {
    'Content-Type': `${CONTENT_TYPES.JSON}; charset=utf-8`,
    'Content-Length': shouldCompress ? body.length : Buffer.byteLength(jsonString, 'utf8'),
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  };

  if (shouldCompress) {
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }

  response.writeHead(statusCode, headers);
  
  response.end(body);
}

/**
 * Send success response
 */
export function sendSuccess(response, data = null, message = 'Success') {
  const payload = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
  
  sendJson(response, 200, payload);
}

/**
 * Send created response (201)
 */
export function sendCreated(response, data = null, message = 'Created') {
  const payload = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };

  sendJson(response, 201, payload);
}

/**
 * Send error response
 */
export function sendError(response, statusCode, message, errorCode = null) {
  const payload = {
    success: false,
    error: {
      message,
      code: errorCode,
      timestamp: new Date().toISOString()
    }
  };
  
  sendJson(response, statusCode, payload);
}

/**
 * Send paginated response
 */
export function sendPaginated(response, data, pagination, message = 'Success') {
  const payload = {
    success: true,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil(pagination.total / (pagination.limit || 10)),
      hasNext: pagination.hasNext || false,
      hasPrev: pagination.hasPrev || false
    },
    message,
    timestamp: new Date().toISOString()
  };
  
  sendJson(response, 200, payload);
}

/**
 * Send file response
 */
export function sendFile(response, filePath, contentType, fileName = null) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const fileContent = fs.readFileSync(filePath);
    const baseName = fileName || path.basename(filePath);
    
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileContent.length,
      'Content-Disposition': `attachment; filename="${baseName}"`,
      'Cache-Control': 'no-cache'
    });
    
    response.end(fileContent);
  } catch (error) {
    sendError(response, 500, 'File not found or cannot be read', 'FILE_ERROR');
  }
}

/**
 * Send stream response
 */
export function sendStream(response, stream, contentType = CONTENT_TYPES.JSON) {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache'
  });
  
  stream.pipe(response);
  
  stream.on('error', (error) => {
    console.error('Stream error:', error);
    if (!response.headersSent) {
      sendError(response, 500, 'Stream error', 'STREAM_ERROR');
    }
  });
}

/**
 * Send SSE (Server-Sent Events) response
 */
export function sendSSE(response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  return {
    send: (data, event = null) => {
      let message = '';
      if (event) message += `event: ${event}\n`;
      message += `data: ${JSON.stringify(data)}\n\n`;
      response.write(message);
    },
    
    close: () => {
      response.end();
    }
  };
}

/**
 * Send redirect response
 */
export function sendRedirect(response, location, statusCode = 302) {
  response.writeHead(statusCode, {
    'Location': location,
    'Content-Type': CONTENT_TYPES.TEXT
  });
  
  response.end(`Redirecting to ${location}`);
}

/**
 * Send no content response
 */
export function sendNoContent(response, statusCode = 204) {
  response.writeHead(statusCode, {
    'Content-Length': '0'
  });
  
  response.end();
}

/**
 * Send CORS preflight response
 */
export function sendPreflight(response) {
  response.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  });
  
  response.end();
}

/**
 * Send health check response
 */
export function sendHealth(response, status = 'healthy', details = {}) {
  const payload = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ...details
  };
  
  const statusCode = status === 'healthy' ? 200 : 503;
  sendJson(response, statusCode, payload);
}

/**
 * Send AI provider status response
 */
export function sendAIStatus(response, providers) {
  const payload = {
    success: true,
    data: {
      providers,
      activeProvider: providers.find(p => p.available)?.name || null,
      totalProviders: providers.length,
      availableProviders: providers.filter(p => p.available).length,
      timestamp: new Date().toISOString()
    }
  };
  
  sendJson(response, 200, payload);
}

/**
 * Send validation error response
 */
export function sendValidationError(response, errors) {
  const payload = {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    }
  };
  
  sendJson(response, 400, payload);
}

/**
 * Send rate limit response
 */
export function sendRateLimit(response, retryAfter = null) {
  const headers = {
    'Content-Type': CONTENT_TYPES.JSON,
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 3600).toString()
  };
  
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }
  
  const payload = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      retryAfter: retryAfter || 3600,
      timestamp: new Date().toISOString()
    }
  };
  
  response.writeHead(429, headers);
  response.end(JSON.stringify(payload));
}

export default {
  sendJson,
  sendSuccess,
  sendCreated,
  sendError,
  sendPaginated,
  sendFile,
  sendStream,
  sendSSE,
  sendRedirect,
  sendNoContent,
  sendPreflight,
  sendHealth,
  sendAIStatus,
  sendValidationError,
  sendRateLimit
};
