/**
 * ML Routes - AutoML endpoint handlers
 */
import { automlService } from '../services/ml/automl-service.js';
import MLClient from '../services/ml-client.js';
import { sendJson } from '../utils/response-utils.js';

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

export async function handleMLRoutes(request, response, pathname) {
  const url = new URL(pathname, `http://${request.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // GET /api/ml/health
  if (pathname === '/api/ml/health' && request.method === 'GET') {
    const python = await MLClient.health();
    return sendJson(response, 200, {
      success: true,
      status: 'ready',
      message: 'Node ML gateway is ready',
      python,
      availableModels: automlService.listModels().length
    });
  }

  const gatewayEndpoints = {
    '/api/ml/profile': (data) => MLClient.profile(data),
    '/api/ml/correlations': (data) => MLClient.correlations(data, null, data.method || 'pearson'),
    '/api/ml/anomalies': (data) => MLClient.anomalies(data, null, data.method),
    '/api/ml/feature-importance': (data) => MLClient.featureImportance(data, data.target || data.target_column),
    '/api/ml/train-model': (data) => MLClient.trainModel(data, data.target || data.target_column, data),
    '/api/ml/predict': (data) => MLClient.predict(data.modelId || data.model_id, data.rows || data.input_data || []),
  };

  if (gatewayEndpoints[pathname] && request.method === 'POST') {
    try {
      const data = await readJson(request);
      const result = await gatewayEndpoints[pathname](data);
      return sendJson(response, result.success === false ? 503 : 200, result);
    } catch (error) {
      return sendJson(response, 500, { success: false, error: error.message });
    }
  }

  if (pathname === '/api/ml/compare-datasets' && request.method === 'POST') {
    try {
      const data = await readJson(request);
      const result = await MLClient.compareDatasets(data.left, data.right);
      return sendJson(response, 200, { success: true, ...result });
    } catch (error) {
      return sendJson(response, 500, { success: false, error: error.message });
    }
  }

  // POST /api/ml/train - Train a model
  if (pathname === '/api/ml/train' && request.method === 'POST') {
    let body = '';
    
    for await (const chunk of request) {
      body += chunk;
    }
    
    try {
      const data = JSON.parse(body);
      const { dataset_id, rows, target_column, problem_type } = data;
      
      if (!dataset_id || !rows || !target_column) {
        return sendJson(response, 400, {
          success: false,
          error: 'Missing required fields: dataset_id, rows, target_column'
        });
      }

      const result = await automlService.trainModel(
        dataset_id,
        rows,
        target_column,
        problem_type || 'auto'
      );

      if (result.success) {
        return sendJson(response, 200, result);
      } else {
        return sendJson(response, 500, result);
      }
    } catch (error) {
      return sendJson(response, 500, {
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/ml/predict - Make predictions
  if (pathname === '/api/ml/predict' && request.method === 'POST') {
    let body = '';
    
    for await (const chunk of request) {
      body += chunk;
    }
    
    try {
      const data = JSON.parse(body);
      const { dataset_id, input_data } = data;
      
      if (!dataset_id || !input_data) {
        return sendJson(response, 400, {
          success: false,
          error: 'Missing required fields: dataset_id, input_data'
        });
      }

      const result = await automlService.predict(dataset_id, input_data);

      if (result.success) {
        return sendJson(response, 200, result);
      } else {
        return sendJson(response, 404, result);
      }
    } catch (error) {
      return sendJson(response, 500, {
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/ml/models - List all models
  if (pathname === '/api/ml/models' && request.method === 'GET') {
    return sendJson(response, 200, {
      success: true,
      models: automlService.listModels()
    });
  }

  // GET /api/ml/models/:id - Get model info
  if (pathParts[2] === 'models' && pathParts[3] && request.method === 'GET') {
    const datasetId = pathParts[3];
    const modelInfo = automlService.getModelInfo(datasetId);
    
    if (modelInfo) {
      return sendJson(response, 200, {
        success: true,
        model: modelInfo
      });
    } else {
      return sendJson(response, 404, {
        success: false,
        error: 'Model not found'
      });
    }
  }

  // DELETE /api/ml/models/:id - Delete model
  if (pathParts[2] === 'models' && pathParts[3] && request.method === 'DELETE') {
    const datasetId = pathParts[3];
    const result = automlService.deleteModel(datasetId);
    
    if (result.success) {
      return sendJson(response, 200, result);
    } else {
      return sendJson(response, 404, result);
    }
  }

  // POST /api/ml/cluster - Cluster analysis
  if (pathname === '/api/ml/cluster' && request.method === 'POST') {
    let body = '';
    
    for await (const chunk of request) {
      body += chunk;
    }
    
    try {
      const data = JSON.parse(body);
      const { rows, feature_columns, num_clusters } = data;
      
      if (!rows || !feature_columns) {
        return sendJson(response, 400, {
          success: false,
          error: 'Missing required fields: rows, feature_columns'
        });
      }

      const result = await automlService.clusterAnalysis(
        rows,
        feature_columns,
        num_clusters || 3
      );

      return sendJson(response, result.success ? 200 : 500, result);
    } catch (error) {
      return sendJson(response, 500, {
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/ml/pca - PCA analysis
  if (pathname === '/api/ml/pca' && request.method === 'POST') {
    let body = '';
    
    for await (const chunk of request) {
      body += chunk;
    }
    
    try {
      const data = JSON.parse(body);
      const { rows, feature_columns, n_components } = data;
      
      if (!rows || !feature_columns) {
        return sendJson(response, 400, {
          success: false,
          error: 'Missing required fields: rows, feature_columns'
        });
      }

      const result = await automlService.pcaAnalysis(
        rows,
        feature_columns,
        n_components || 2
      );

      return sendJson(response, result.success ? 200 : 500, result);
    } catch (error) {
      return sendJson(response, 500, {
        success: false,
        error: error.message
      });
    }
  }

  return false;
}
