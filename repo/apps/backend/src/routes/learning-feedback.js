import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import {
  saveLearningCorrection,
  retrieveLearningMemory,
} from "../services/ai-analyst/self-learning-memory.js";

async function getRequestBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

export async function handleLearningFeedbackRoutes(request, response, pathname) {
  const { method } = request;

  // POST /api/learning-feedback/save-correction
  if (pathname === '/api/learning-feedback/save-correction' && method === 'POST') {
    try {
      const body = await getRequestBody(request);
      const correction = saveLearningCorrection(body);

      sendSuccess(response, {
        success: true,
        message: "Correction saved. AI will use this in future similar questions.",
        correction,
      }, 'Correction saved successfully');
      return true;
    } catch (error) {
      console.error('[LEARNING-FEEDBACK] Save correction error:', error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to save correction',
        ERROR_CODES.DATABASE_ERROR
      );
      return true;
    }
  }

  // POST /api/learning-feedback/retrieve
  if (pathname === '/api/learning-feedback/retrieve' && method === 'POST') {
    try {
      const body = await getRequestBody(request);
      const memories = retrieveLearningMemory(body);

      sendSuccess(response, {
        success: true,
        memories,
      }, 'Memories retrieved successfully');
      return true;
    } catch (error) {
      console.error('[LEARNING-FEEDBACK] Retrieve memory error:', error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to retrieve memories',
        ERROR_CODES.DATABASE_ERROR
      );
      return true;
    }
  }

  return false;
}

export default {
  handleLearningFeedbackRoutes,
};
