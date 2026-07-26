export const serviceUrls = {
  frontend: process.env.FRONTEND_URL || 'http://localhost:5173',
  ollama: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ml: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  api: process.env.BACKEND_URL || process.env.API_BASE_URL || 'http://localhost:3001',
};

export function getFrontendUrl(protocol = 'http') {
  return serviceUrls.frontend;
}

export function getOllamaUrl() {
  return serviceUrls.ollama;
}

export function getMlServiceUrl() {
  return serviceUrls.ml;
}

export default serviceUrls;
