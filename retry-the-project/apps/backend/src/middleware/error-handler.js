// Global error handler middleware
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { sendJson } from '../utils/response-utils.js';
import config from '../config/environment.js';

export function errorHandler(error, request, response) {
  console.error('❌ Error:', error.message);
  
  // Log stack trace in development
  if (config.server.nodeEnv === 'development') {
    console.error('Stack trace:', error.stack);
  }

  // Determine status code and error code
  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = error.message || 'Validation failed';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    errorCode = ERROR_CODES.INSUFFICIENT_PERMISSIONS;
    message = 'Unauthorized access';
  } else if (error.name === 'NotFoundError') {
    statusCode = HTTP_STATUS.NOT_FOUND;
    errorCode = ERROR_CODES.DATASET_NOT_FOUND;
    message = error.message || 'Resource not found';
  } else if (error.name === 'ConflictError') {
    statusCode = HTTP_STATUS.CONFLICT;
    errorCode = ERROR_CODES.RESOURCE_CONFLICT;
    message = error.message || 'Resource conflict';
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    statusCode = HTTP_STATUS.BAD_GATEWAY;
    errorCode = ERROR_CODES.NETWORK_ERROR;
    message = 'Network error - service unavailable';
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = HTTP_STATUS.GATEWAY_TIMEOUT;
    errorCode = ERROR_CODES.AI_TIMEOUT;
    message = 'Request timeout';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message || message;
  }

  // Log error details
  const errorDetails = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    pathname: request.pathname,
    statusCode,
    errorCode,
    message,
    userAgent: request.headers['user-agent'],
    ip: request.headers['x-forwarded-for'] || request.connection?.remoteAddress,
    duration: Date.now() - (request.startTime || Date.now())
  };

  console.error('Error details:', errorDetails);

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: errorDetails.timestamp,
      requestId: request.headers['x-request-id'] || null
    }
  };

  // Include stack trace in development
  if (config.server.nodeEnv === 'development' && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  sendJson(response, statusCode, errorResponse);
}

/**
 * Create specific error types
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = HTTP_STATUS.BAD_REQUEST;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = HTTP_STATUS.NOT_FOUND;
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = HTTP_STATUS.CONFLICT;
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = HTTP_STATUS.UNAUTHORIZED;
  }
}

export class AIProviderError extends Error {
  constructor(message, provider) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
  }
}

export class DatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
}

export class FileSystemError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FileSystemError';
    this.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
}

export default {
  errorHandler,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  AIProviderError,
  DatabaseError,
  FileSystemError
};
