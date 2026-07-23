// Request logging middleware
import config from '../config/environment.js';

export function requestLogger(request, response) {
  const startTime = request.startTime || Date.now();
  const requestId = request.headers['x-request-id'] || 'unknown';

  // Store original end method
  const originalEnd = response.end;

  // Override end method to log when response is sent
  response.end = function(...args) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log request details
    const logData = {
      requestId,
      method: request.method,
      url: request.url,
      pathname: request.pathname,
      statusCode: response.statusCode,
      duration: `${duration}ms`,
      userAgent: request.headers['user-agent'] || 'unknown',
      ip: getClientIP(request),
      timestamp: new Date().toISOString()
    };

    // Add content length if available
    if (response.getHeader('content-length')) {
      logData.contentLength = response.getHeader('content-length');
    }

    // Log based on status code and log level
    const logLevel = getLogLevel(response.statusCode);
    
    if (shouldLog(logLevel)) {
      const message = `${request.method} ${request.pathname} ${response.statusCode} - ${duration}ms`;
      
      switch (logLevel) {
        case 'error':
          console.error(`❌ [${requestId}] ${message}`, logData);
          break;
        case 'warn':
          console.warn(`⚠️  [${requestId}] ${message}`, logData);
          break;
        case 'info':
          console.info(`ℹ️  [${requestId}] ${message}`, logData);
          break;
        default:
          console.log(`📝 [${requestId}] ${message}`, logData);
      }
    }

    // Call original end method
    originalEnd.apply(response, args);
  };

  // Store request ID on request object
  request.requestId = requestId;
}

/**
 * Get client IP address
 */
function getClientIP(request) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0] ||
    request.headers['x-real-ip'] ||
    request.connection?.remoteAddress ||
    request.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Determine log level based on status code
 */
function getLogLevel(statusCode) {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  if (statusCode >= 300) return 'info';
  return 'debug';
}

/**
 * Check if we should log based on configuration
 */
function shouldLog(level) {
  if (!config.logging.verbose) {
    // Only log important messages when not verbose
    return ['error', 'warn'].includes(level);
  }
  return true;
}

/**
 * Log startup message
 */
export function logStartup() {
  console.log('\n🚀 ===== InsightFlow API Starting =====');
  console.log(`📍 Environment: ${config.server.nodeEnv}`);
  console.log(`📍 Host: ${config.server.host}`);
  console.log(`📍 Port: ${config.server.port}`);
  console.log(`📍 Log Level: ${config.logging.level}`);
  console.log(`📍 Verbose Logging: ${config.logging.verbose}`);
  console.log(`📍 CORS Origin: ${config.cors.origin}`);
  console.log(`📍 AI Providers: ${config.ai.providerPriority.join(', ')}`);
  console.log('=====================================\n');
}

/**
 * Log shutdown message
 */
export function logShutdown() {
  console.log('\n🛑 ===== InsightFlow API Shutting Down =====');
  console.log(`📍 Shutdown Time: ${new Date().toISOString()}`);
  console.log('==========================================\n');
}

export default {
  requestLogger,
  logStartup,
  logShutdown
};
