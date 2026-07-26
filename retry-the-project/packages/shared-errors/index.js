/**
 * Shared Errors Package
 * Centralized error classes for the application
 */

// Base Application Error
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

// Validation Error
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.details && { details: this.details }),
    };
  }
}

// Not Found Error
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// Unauthorized Error
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// Forbidden Error
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// Conflict Error
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// AI Error
export class AIError extends AppError {
  constructor(message, code = 'AI_ERROR', details = null) {
    super(message, 500, code);
    this.name = 'AIError';
    this.details = details;
  }
}

// AI Timeout Error
export class AITimeoutError extends AIError {
  constructor(message = 'AI request timed out') {
    super(message, 'AI_TIMEOUT', { timeout: true });
    this.name = 'AITimeoutError';
  }
}

// AI Response Error
export class AIResponseError extends AIError {
  constructor(message = 'Invalid AI response') {
    super(message, 'AI_RESPONSE_ERROR', { invalidResponse: true });
    this.name = 'AIResponseError';
  }
}

// Database Error
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(process.env.NODE_ENV === 'development' && this.originalError && {
        originalError: this.originalError.message,
      }),
    };
  }
}

// File Processing Error
export class FileProcessingError extends AppError {
  constructor(message = 'File processing failed', code = 'FILE_ERROR') {
    super(message, 400, code);
    this.name = 'FileProcessingError';
  }
}

// Schema Error
export class SchemaError extends AppError {
  constructor(message = 'Schema validation failed') {
    super(message, 400, 'SCHEMA_ERROR');
    this.name = 'SchemaError';
  }
}

// Error Factory
export function createError(type, message, details = null) {
  const errorMap = {
    VALIDATION: () => new ValidationError(message, details),
    NOT_FOUND: () => new NotFoundError(message),
    UNAUTHORIZED: () => new UnauthorizedError(message),
    FORBIDDEN: () => new ForbiddenError(message),
    CONFLICT: () => new ConflictError(message),
    AI: () => new AIError(message, 'AI_ERROR', details),
    AI_TIMEOUT: () => new AITimeoutError(message),
    AI_RESPONSE: () => new AIResponseError(message),
    DATABASE: () => new DatabaseError(message, details),
    FILE: () => new FileProcessingError(message),
    SCHEMA: () => new SchemaError(message),
  };

  const ErrorClass = errorMap[type];
  if (!ErrorClass) {
    return new AppError(message);
  }

  return ErrorClass();
}

// Error Handler
export function handleError(error) {
  if (error.isOperational) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify(error.toJSON()),
    };
  }

  // Unknown error
  console.error('[Unhandled Error]', error);
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    }),
  };
}

export default {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  AIError,
  AITimeoutError,
  AIResponseError,
  DatabaseError,
  FileProcessingError,
  SchemaError,
  createError,
  handleError,
};