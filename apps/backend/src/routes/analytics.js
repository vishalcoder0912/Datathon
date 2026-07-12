// Analytics-related routes with AI integration
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { updateAnalysis } from './state.js';
import { getDatasetById } from '../database/dataset-repository.js';
import { buildSchemaPacketAsync } from '../services/schema-packet-builder.js';
import MLClient from '../services/ml-client.js';

function getRouteDataset(pathname) {
  const datasetId = pathname.split('/')[3];
  return getDatasetById(datasetId);
}

export async function handleAnalyticsRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/datasets/:id/ai-correlations - AI-powered correlations
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai-correlations$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const correlations = await MLClient.correlations(
        dataset,
        () => ({ method: 'pearson', matrix: [], strongPairs: calculateCorrelations(dataset) }),
      );

      if (correlations && Array.isArray(correlations.strongPairs)) {
        correlations.strongPairs = correlations.strongPairs.map(c => ({
          ...c,
          column1: c.column1 || c.columnA,
          column2: c.column2 || c.columnB,
          columnA: c.columnA || c.column1,
          columnB: c.columnB || c.column2
        }));
      }
      
      sendSuccess(response, {
        correlations,
        summary: `Found ${correlations.strongPairs?.length || 0} correlations in the dataset`,
        hasGemini: false
      }, 'Correlations calculated');
      return true;
    } catch (error) {
      console.error('Correlations error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to find correlations', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/ai/profile - AI profile analysis
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai\/profile$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const profile = await MLClient.profile(dataset, () => generateDataProfile(dataset));
      
      sendSuccess(response, { profile }, 'Profile generated');
      return true;
    } catch (error) {
      console.error('Profile error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate profile', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/ai/anomalies - AI anomaly detection
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai\/anomalies$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const anomalies = await MLClient.anomalies(
        dataset,
        () => ({ method: 'zscore', anomalies: detectAnomalies(dataset), summary: {} }),
      );
      
      sendSuccess(response, { anomalies }, 'Anomalies detected');
      return true;
    } catch (error) {
      console.error('Anomalies error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to detect anomalies', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/ai/relationships - AI relationship analysis
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai\/relationships$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const relationships = analyzeRelationships(dataset);
      
      sendSuccess(response, { relationships }, 'Relationships analyzed');
      return true;
    } catch (error) {
      console.error('Relationships error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to analyze relationships', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/ai/cleaning - AI cleaning suggestions
  if (pathname.match(/^\/api\/datasets\/[^/]+\/ai\/cleaning$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const suggestions = generateCleaningSuggestions(dataset);
      
      sendSuccess(response, { suggestions }, 'Cleaning suggestions generated');
      return true;
    } catch (error) {
      console.error('Cleaning error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate suggestions', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/analyze - Analyze dataset
  if (pathname.match(/^\/api\/datasets\/[^/]+\/analyze$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const analysis = await MLClient.profile(dataset, () => analyzeDataset(dataset));
      updateAnalysis(analysis);
      
      sendSuccess(response, { analysis }, 'Dataset analyzed');
      return true;
    } catch (error) {
      console.error('Dataset analysis error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to analyze dataset', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/schema - Get dataset schema
  if (pathname.match(/^\/api\/datasets\/[^/]+\/schema$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }

      const schema = await buildSchemaPacketAsync(dataset);

      sendSuccess(response, { schema }, 'Schema generated');
      return true;
    } catch (error) {
      console.error('[SCHEMA] Error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || 'Failed to generate schema', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  // GET /api/datasets/:id/auto-charts - Generate auto charts
  if (pathname.match(/^\/api\/datasets\/[^/]+\/auto-charts$/) && method === 'GET') {
    try {
      const dataset = getRouteDataset(pathname);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const charts = generateAutoCharts(dataset);
      
      sendSuccess(response, { charts }, 'Auto charts generated');
      return true;
    } catch (error) {
      console.error('Auto charts error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate auto charts', ERROR_CODES.AI_ERROR);
      return true;
    }
  }

  return false;
}

// Helper functions
function calculateCorrelations(dataset) {
  const { rows, columns } = dataset;
  const numericCols = columns.filter(c => c.type === 'number' || c.inferredType === 'numeric');
  const correlations = [];
  
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const col1 = numericCols[i].name;
      const col2 = numericCols[j].name;
      const coef = calculatePearsonCorrelation(rows, col1, col2);
      const absCoef = Math.abs(coef);
      
      correlations.push({
        column1: col1,
        columnA: col1,
        column2: col2,
        columnB: col2,
        coefficient: parseFloat(coef.toFixed(3)),
        strength: absCoef > 0.7 ? 'strong' : absCoef > 0.4 ? 'moderate' : 'weak',
        interpretation: coef > 0 ? 'positive correlation' : 'negative correlation',
        sampleSize: rows.length
      });
    }
  }
  
  return correlations;
}

function calculatePearsonCorrelation(rows, col1, col2) {
  const values = rows.map(r => [parseFloat(r[col1]), parseFloat(r[col2])]).filter(v => !isNaN(v[0]) && !isNaN(v[1]));
  if (values.length < 2) return 0;
  
  const n = values.length;
  const sumX = values.reduce((s, v) => s + v[0], 0);
  const sumY = values.reduce((s, v) => s + v[1], 0);
  const sumXY = values.reduce((s, v) => s + v[0] * v[1], 0);
  const sumX2 = values.reduce((s, v) => s + v[0] * v[0], 0);
  const sumY2 = values.reduce((s, v) => s + v[1] * v[1], 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function generateDataProfile(dataset) {
  const { rows, columns } = dataset;
  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: columns.map(c => ({
      name: c.name,
      type: c.type || c.inferredType || 'unknown',
      missingValues: rows.filter(r => r[c.name] === null || r[c.name] === undefined).length,
      uniqueValues: [...new Set(rows.map(r => r[c.name]))].length
    })),
    quality: {
      completeness: ((rows.length * columns.length - rows.reduce((acc, r) => acc + columns.filter(c => r[c.name] === null || r[c.name] === undefined).length, 0)) / (rows.length * columns.length) * 100).toFixed(1) + '%',
      issues: []
    }
  };
}

function detectAnomalies(dataset) {
  const { rows, columns } = dataset;
  const numericCols = columns.filter(c => c.type === 'number' || c.inferredType === 'numeric');
  const anomalies = [];
  
  numericCols.forEach(col => {
    const values = rows.map(r => parseFloat(r[col.name])).filter(v => !isNaN(v));
    if (values.length === 0) return;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length);
    
    rows.forEach((row, idx) => {
      const val = parseFloat(row[col.name]);
      if (!isNaN(val) && std > 0 && Math.abs((val - mean) / std) > 2) {
        anomalies.push({
          row: idx,
          column: col.name,
          value: val,
          zScore: parseFloat(((val - mean) / std).toFixed(2)),
          type: 'statistical_outlier'
        });
      }
    });
  });
  
  return anomalies;
}

function analyzeRelationships(dataset) {
  const { columns } = dataset;
  return {
    numeric: columns.filter(c => c.type === 'number' || c.inferredType === 'numeric').map(c => c.name),
    categorical: columns.filter(c => c.type === 'string' || c.inferredType === 'categorical').map(c => c.name),
    temporal: columns.filter(c => c.type === 'date' || c.inferredType === 'date').map(c => c.name),
    relationships: []
  };
}

function generateCleaningSuggestions(dataset) {
  const { rows, columns } = dataset;
  const suggestions = [];
  
  columns.forEach(col => {
    const missingCount = rows.filter(r => r[col.name] === null || r[col.name] === undefined || r[col.name] === '').length;
    if (missingCount > 0) {
      suggestions.push({
        column: col.name,
        issue: 'missing_values',
        count: missingCount,
        suggestion: `Fill ${missingCount} missing values with ${col.type === 'number' ? 'mean/median' : 'mode'}`
      });
    }
    
    const uniqueValues = [...new Set(rows.map(r => r[col.name]))];
    if (uniqueValues.length < rows.length * 0.05 && col.type !== 'string' && col.inferredType !== 'categorical') {
      suggestions.push({
        column: col.name,
        issue: 'low_cardinality',
        suggestion: 'Consider converting to categorical type'
      });
    }
  });
  
  return suggestions;
}

function analyzeDataset(dataset) {
  const { rows, columns } = dataset;
  const numericCols = columns.filter(c => c.type === 'number' || c.inferredType === 'numeric');
  
  return {
    summary: `Dataset with ${rows.length} rows and ${columns.length} columns`,
    insights: [
      `${numericCols.length} numeric columns available for analysis`,
      `${columns.length - numericCols.length} categorical columns for grouping`
    ],
    statistics: numericCols.reduce((acc, col) => {
      const values = rows.map(r => parseFloat(r[col.name])).filter(v => !isNaN(v));
      if (values.length > 0) {
        acc[col.name] = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length
        };
      }
      return acc;
    }, {})
  };
}

function generateAutoCharts(dataset) {
  const { columns } = dataset;
  const numericCols = columns.filter(c => c.type === 'number' || c.inferredType === 'numeric');
  const categoricalCols = columns.filter(c => c.type === 'string' || c.inferredType === 'categorical');
  
  const charts = [];
  
  // Histograms for numeric columns
  numericCols.slice(0, 3).forEach(col => {
    charts.push({
      type: 'histogram',
      title: `Distribution of ${col.name}`,
      xAxis: col.name,
      yAxis: 'Count'
    });
  });
  
  // Bar charts for categorical + numeric
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    charts.push({
      type: 'bar',
      title: `${categoricalCols[0].name} vs ${numericCols[0].name}`,
      xAxis: categoricalCols[0].name,
      yAxis: numericCols[0].name
    });
  }
  
  return charts;
}

export default { handleAnalyticsRoutes };
