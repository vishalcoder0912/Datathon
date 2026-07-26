/**
 * Logger Middleware
 * Request/Response logging
 */

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

const currentLevel = process.env.LOG_LEVEL || LOG_LEVELS.INFO;

/**
 * Log a message with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta,
  };

  // Console output with color
  const colors = {
    error: '\x1b[31m',   // red
    warn: '\x1b[33m',    // yellow
    info: '\x1b[36m',    // cyan
    debug: '\x1b[90m',   // gray
    reset: '\x1b[0m',
  };

  const color = colors[level] || colors.info;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}:${colors.reset} ${message}`);
  
  if (Object.keys(meta).length > 0) {
    console.log(`${color}Meta:${colors.reset}`, JSON.stringify(meta, null, 2));
  }
}

/**
 * Request logger middleware
 * @param {Object} request - HTTP request
 * @returns {Function} Logger function
 */
export function requestLogger(request) {
  const start = Date.now();
  
  return {
    logRequest: () => {
      log(LOG_LEVELS.INFO, 'Incoming Request', {
        method: request.method,
        url: request.url,
        headers: {
          host: request.headers.host,
          contentType: request.headers['content-type'],
        },
      });
    },
    
    logResponse: (statusCode, responseTime) => {
      const level = statusCode >= 500 ? LOG_LEVELS.ERROR 
        : statusCode >= 400 ? LOG_LEVELS.WARN 
        : LOG_LEVELS.INFO;
      
      log(level, 'Request Complete', {
        method: request.method,
        url: request.url,
        status: statusCode,
        responseTime: `${responseTime}ms`,
      });
    },
    
    logError: (error) => {
      log(LOG_LEVELS.ERROR, 'Request Error', {
        method: request.method,
        url: request.url,
        error: error.message,
        stack: error.stack,
      });
    },
    
    getDuration: () => Date.now() - start,
  };
}

/**
 * Create logger instance
 */
export const logger = {
  error: (message, meta) => log(LOG_LEVELS.ERROR, message, meta),
  warn: (message, meta) => log(LOG_LEVELS.WARN, message, meta),
  info: (message, meta) => log(LOG_LEVELS.INFO, message, meta),
  debug: (message, meta) => log(LOG_LEVELS.DEBUG, message, meta),
};

export default logger;