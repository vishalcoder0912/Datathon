import { prepareDatasetForAnalytics, buildDatasetSchema, toNumber } from '@insightflow/shared-analytics';
import { classifyColumns, smartAutoChartGeneration, buildEnhancedSchema } from './schema-detector.js';
import { reportGenerator } from './report-generator.js';
import { predictiveAnalytics } from './predictive-analytics.js';
import { alertService } from './alert-service.js';
import { recommendationEngine } from './recommendation-engine.js';

function getCleanColumnClassification(rows) {
  const classification = classifyColumns(rows);
  return {
    numeric: classification.numeric || [],
    categorical: classification.categorical || [],
    date: classification.date || []
  };
}

export class DataPipeline {
  constructor() {
    this.datasets = new Map();
  }

  async processDataset(rawDataset) {
    const prepared = prepareDatasetForAnalytics(rawDataset);
    const classification = getCleanColumnClassification(prepared.rows);
    const schema = buildDatasetSchema(prepared);
    const enhancedSchema = buildEnhancedSchema(prepared.columns, prepared.rows);
    const charts = smartAutoChartGeneration(prepared.rows, classification);
    const columnStats = this.calculateColumnStats(prepared.rows, prepared.columns);
    
    const processed = {
      ...prepared,
      classification,
      schema,
      enhancedSchema,
      charts,
      columnStats,
      processedAt: new Date().toISOString()
    };

    this.datasets.set(prepared.id || prepared.name, processed);
    return processed;
  }

  calculateColumnStats(rows, columns) {
    const stats = {};
    
    for (const col of columns) {
      const values = rows.map(r => r[col.name]).filter(v => v != null);
      const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v));
      
      if (numericValues.length > values.length * 0.7) {
        numericValues.sort((a, b) => a - b);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        stats[col.name] = {
          type: 'numeric',
          count: numericValues.length,
          missing: values.length - numericValues.length,
          unique: new Set(numericValues).size,
          min: numericValues[0],
          max: numericValues[numericValues.length - 1],
          mean: sum / numericValues.length,
          median: numericValues[Math.floor(numericValues.length / 2)],
          std: this.calculateStd(numericValues)
        };
      } else {
        stats[col.name] = {
          type: 'categorical',
          count: values.length,
          missing: rows.length - values.length,
          unique: new Set(values).size
        };
      }
    }

    return stats;
  }

  calculateStd(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  async generateFullAnalysis(datasetId) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) return { error: 'Dataset not found' };

    const analysis = {
      dataset: {
        name: dataset.name,
        rowCount: dataset.rowCount,
        columnCount: dataset.columns?.length
      },
      columnStats: dataset.columnStats,
      charts: dataset.charts,
      insights: [],
      predictions: {},
      alerts: [],
      recommendations: []
    };

    try {
      analysis.recommendations = await recommendationEngine.generateRecommendations(dataset);
    } catch (e) {
      analysis.recommendations = [];
    }

    const numericCols = dataset.classification?.numeric || [];
    if (numericCols.length > 0) {
      try {
        analysis.predictions = await predictiveAnalytics.analyzeMultipleMetrics(
          dataset.rows,
          numericCols.slice(0, 3)
        );
      } catch (e) {
        analysis.predictions = {};
      }
    }

    try {
      const alertResults = await alertService.checkAllAlerts(dataset);
      analysis.alerts = alertResults;
    } catch (e) {
      analysis.alerts = [];
    }

    return analysis;
  }

  async generateReport(datasetId, options = {}) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) return { error: 'Dataset not found' };

    return reportGenerator.generateReport(dataset, options);
  }

  getDataset(id) {
    return this.datasets.get(id);
  }

  listDatasets() {
    return Array.from(this.datasets.keys());
  }

  clearDatasets() {
    this.datasets.clear();
  }
}

export const pipelineService = new DataPipeline();