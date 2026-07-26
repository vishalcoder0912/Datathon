/**
 * Validation Middleware
 * Input validation utilities
 */

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @throws {Error} If validation fails
 */
export function validateRequired(body, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate that value is a positive number
 * @param {any} value - Value to check
 * @returns {boolean} True if positive number
 */
export function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Sanitize string input (basic XSS protection)
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate file upload
 * @param {Object} file - File object
 * @param {string[]} allowedTypes - Allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 * @throws {Error} If validation fails
 */
export function validateFile(file, allowedTypes, maxSize) {
  if (!file) {
    const error = new Error('No file provided');
    error.code = 'NO_FILE';
    error.statusCode = 400;
    throw error;
  }
  
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    const error = new Error(`File type ${file.type} not allowed. Allowed: ${allowedTypes.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    error.statusCode = 400;
    throw error;
  }
  
  if (maxSize && file.size > maxSize) {
    const error = new Error(`File size exceeds maximum of ${maxSize} bytes`);
    error.code = 'FILE_TOO_LARGE';
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate JSON body
 * @param {string} body - Raw body string
 * @returns {Object} Parsed JSON
 * @throws {Error} If parsing fails
 */
export function validateJSONBody(body) {
  if (!body || body.trim() === '') {
    return {};
  }
  
  try {
    return JSON.parse(body);
  } catch (error) {
    const err = new Error('Invalid JSON body');
    err.code = 'INVALID_JSON';
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Create request validator
 * @param {Object} schema - Validation schema
 * @returns {Function} Validator function
 */
export function validate(schema) {
  return (body) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];
      
      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip further validation if not required and empty
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // Type check
      if (rules.type) {
        const actualType = typeof value;
        if (actualType !== rules.type && !isTypeMatch(actualType, rules.type)) {
          errors.push(`${field} must be of type ${rules.type}`);
        }
      }
      
      // Custom validator
      if (rules.validate && typeof rules.validate === 'function') {
        const result = rules.validate(value);
        if (result !== true) {
          errors.push(`${field}: ${result}`);
        }
      }
      
      // Range validation for numbers
      if (rules.min !== undefined && Number(value) < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      
      if (rules.max !== undefined && Number(value) > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
      
      // Length validation for strings
      if (rules.minLength !== undefined && String(value).length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      
      if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }
    
    if (errors.length > 0) {
      const error = new Error(errors.join('; '));
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      error.details = errors;
      throw error;
    }
    
    return true;
  };
}

function isTypeMatch(actual, expected) {
  const typeMap = {
    number: ['number', 'integer'],
    integer: ['number', 'integer'],
    string: ['string'],
    boolean: ['boolean'],
    array: ['array'],
    object: ['object'],
  };
  
  return typeMap[expected]?.includes(actual) || false;
}

export default {
  validateRequired,
  isValidEmail,
  isValidUUID,
  isPositiveNumber,
  sanitizeString,
  validateFile,
  validateJSONBody,
  validate,
};