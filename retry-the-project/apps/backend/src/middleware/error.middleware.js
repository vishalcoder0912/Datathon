/**
 * Global Error Middleware
 * Centralized error handling for the backend
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class AIError extends AppError {
  constructor(message, code = 'AI_ERROR', details = null) {
    super(message, 500, code);
    this.details = details;
  }
}

export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/**
 * Express-style error handler for Node.js HTTP server
 * @param {Error} err - Error object
 * @param {Object} response - HTTP response object
 */
export function errorMiddleware(err, response) {
  console.error('[Error Middleware]', {
    message: err.message,
    code: err.code,
    stack: err.stack,
  });

  // Operational errors (known errors)
  if (err.isOperational) {
    response.writeHead(err.statusCode || 500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    response.end(JSON.stringify({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
    }));
    return;
  }

  // Programming errors (unknown errors)
  response.writeHead(500, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  }));
}

/**
 * Async handler wrapper to catch errors
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function
 */
export function asyncHandler(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      const res = args[args.length - 1]; // Assume last arg is response
      if (res && res.writeHead) {
        errorMiddleware(error, res);
      }
    }
  };
}

/**
 * Not found handler for unmatched routes
 * @param {Object} response - HTTP response object
 */
export function notFoundHandler(response) {
  response.writeHead(404, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify({
    error: 'Route not found',
    code: 'NOT_FOUND',
  }));
}