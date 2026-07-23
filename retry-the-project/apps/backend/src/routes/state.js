// Application state endpoint
import fs from 'node:fs';
import path from 'node:path';
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';
import { getChatMessages, getCurrentDataset } from '../database/dataset-repository.js';

function findPdfIdByDatasetId(datasetId) {
  try {
    const intelStorePath = path.resolve('data', 'pdf-intelligence-store.json');
    if (fs.existsSync(intelStorePath)) {
      const intelStore = JSON.parse(fs.readFileSync(intelStorePath, 'utf8'));
      for (const [pdfId, analysis] of Object.entries(intelStore)) {
        if (analysis.datasetId === datasetId) {
          return pdfId;
        }
      }
    }
  } catch (e) {
    console.error('Error reading pdf-intelligence-store:', e);
  }

  try {
    const knowledgeStorePath = path.resolve('data', 'pdf-knowledge-store.json');
    if (fs.existsSync(knowledgeStorePath)) {
      const knowledgeStore = JSON.parse(fs.readFileSync(knowledgeStorePath, 'utf8'));
      for (const [pdfId, payload] of Object.entries(knowledgeStore)) {
        if (payload.datasetId === datasetId) {
          return pdfId;
        }
      }
    }
  } catch (e) {
    console.error('Error reading pdf-knowledge-store:', e);
  }

  return null;
}

// In-memory UI state. Datasets and chat history hydrate from SQLite; analysis
// remains in memory until a persisted analysis store exists.
let appState = {
  dataset: null,
  chatMessages: [],
  analysis: null
};

export async function handleStateRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/state - Get current application state
  if (pathname === '/api/state' && method === 'GET') {
    try {
      const persistedDataset = getCurrentDataset();
      if (persistedDataset) {
        const pdfId = findPdfIdByDatasetId(persistedDataset.id);
        if (pdfId) {
          persistedDataset.pdf = {
            id: pdfId,
            datasetId: persistedDataset.id,
            fileName: persistedDataset.fileName,
          };
        }
        appState.dataset = persistedDataset;
        appState.chatMessages = getChatMessages(persistedDataset.id);
      }

      sendSuccess(response, {
        dataset: appState.dataset,
        chatMessages: appState.chatMessages,
        analysis: appState.analysis
      }, 'Application state retrieved');
      return true;
    } catch (error) {
      console.error('Error getting state:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get state', 'STATE_ERROR');
      return true;
    }
  }

  // POST /api/state/reset - Reset application state
  if (pathname === '/api/state/reset' && method === 'POST') {
    try {
      appState = {
        dataset: null,
        chatMessages: [],
        analysis: null
      };
      
      sendSuccess(response, appState, 'Application state reset');
      return true;
    } catch (error) {
      console.error('Error resetting state:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to reset state', 'STATE_ERROR');
      return true;
    }
  }

  // PUT /api/state - Update application state
  if (pathname === '/api/state' && method === 'PUT') {
    try {
      let body = '';
      
      for await (const chunk of request) {
        body += chunk.toString();
      }
      
      const updates = JSON.parse(body);
      
      // Update state with provided values
      if (updates.dataset !== undefined) {
        appState.dataset = updates.dataset;
      }
      if (updates.chatMessages !== undefined) {
        appState.chatMessages = updates.chatMessages;
      }
      if (updates.analysis !== undefined) {
        appState.analysis = updates.analysis;
      }
      
      sendSuccess(response, appState, 'Application state updated');
      return true;
    } catch (error) {
      console.error('Error updating state:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to update state', 'STATE_ERROR');
      return true;
    }
  }

  return false;
}

// Export state manager for use in other routes
export function getState() {
  return appState;
}

export function setState(newState) {
  appState = { ...appState, ...newState };
}

export function updateDataset(dataset) {
  appState.dataset = dataset;
}

export function updateChatMessages(messages) {
  appState.chatMessages = messages;
}

export function updateAnalysis(analysis) {
  appState.analysis = analysis;
}

export function addChatMessage(message) {
  appState.chatMessages.push(message);
}

export function clearChat() {
  appState.chatMessages = [];
}

export default {
  handleStateRoutes,
  getState,
  setState,
  updateDataset,
  updateChatMessages,
  updateAnalysis,
  addChatMessage,
  clearChat
};
