import { toNumber, buildDatasetSchema } from '@insightflow/shared-analytics';
import { classifyColumns } from './schema-detector.js';

function getCleanColumnClassification(rows) {
  const classification = classifyColumns(rows);
  return {
    numeric: classification.numeric || [],
    categorical: classification.categorical || [],
    date: classification.date || []
  };
}

export class RecommendationEngine {
  constructor() {
    this.insights = [];
    this.recommendations = [];
  }

  async generateRecommendations(dataset) {
    const recommendations = [];
    const cols = getCleanColumnClassification(dataset.rows || []);
    const schema = buildDatasetSchema(dataset);

    if (cols.numeric.length > 0) {
      recommendations.push(...this.analyzeNumericColumns(dataset, cols.numeric));
    }
    
    if (cols.categorical.length > 0) {
      recommendations.push(...this.analyzeCategoricalColumns(dataset, cols.categorical));
    }

    if (cols.numeric.length >= 2) {
      recommendations.push(...this.analyzeCorrelations(dataset, cols.numeric));
    }

    recommendations.push(...this.analyzeDataQuality(dataset));

    return recommendations.slice(0, 10);
  }

  analyzeNumericColumns(dataset, numericCols) {
    const recommendations = [];
    const rows = dataset.rows || [];
    
    for (const col of numericCols.slice(0, 5)) {
      const values = rows.map(r => toNumber(r[col])).filter(v => v !== null);
      if (values.length === 0) continue;

      const stats = this.calculateStats(values);
      const skewness = this.calculateSkewness(values);
      const hasOutliers = this.detectOutliers(values);
      const hasZeros = values.filter(v => v === 0).length / values.length > 0.3;

      if (hasOutliers) {
        recommendations.push({
          type: 'outlier',
          priority: 'medium',
          title: `Review outliers in ${col}`,
          message: `${col} contains statistical outliers that may need investigation.`,
          action: `Investigate ${col} outliers`,
          metric: col
        });
      }

      if (skewness > 1 || skewness < -1) {
        recommendations.push({
          type: 'distribution',
          priority: hasOutliers ? 'high' : 'low',
          title: `${col} has skewed distribution`,
          message: `${col} shows ${skewness > 0 ? 'positive' : 'negative'} skew. Consider transformation.`,
          action: `Apply log or Box-Cox transformation to ${col}`,
          metric: col
        });
      }

      if (hasZeros) {
        recommendations.push({
          type: 'data_quality',
          priority: 'medium',
          title: `High proportion of zeros in ${col}`,
          message: `${col} has ${Math.round(hasZeros * 100)}% zero values. Verify if expected.`,
          action: `Verify zero values in ${col}`,
          metric: col
        });
      }

      const cv = (stats.std / stats.mean) * 100;
      if (cv > 100) {
        recommendations.push({
          type: 'variability',
          priority: 'low',
          title: `High variability in ${col}`,
          message: `${col} has coefficient of variation ${cv.toFixed(0)}%. Data is highly variable.`,
          action: `Review data collection for ${col}`,
          metric: col
        });
      }
    }

    return recommendations;
  }

  analyzeCategoricalColumns(dataset, categoricalCols) {
    const recommendations = [];
    const rows = dataset.rows || [];

    for (const col of categoricalCols.slice(0, 5)) {
      const valueCounts = {};
      rows.forEach(row => {
        const val = row[col];
        if (val) valueCounts[val] = (valueCounts[val] || 0) + 1;
      });

      const uniqueCount = Object.keys(valueCounts).length;
      const totalRows = rows.length;
      const cardinality = uniqueCount / totalRows;

      if (cardinality > 0.9 && uniqueCount > 50) {
        recommendations.push({
          type: 'cardinality',
          priority: 'low',
          title: `High cardinality in ${col}`,
          message: `${col} has ${uniqueCount} unique values (${(cardinality * 100).toFixed(0)}% unique).`,
          action: `Consider grouping rare values in ${col}`,
          metric: col
        });
      }

      const topValues = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (topValues.length > 0 && topValues[0][1] / totalRows > 0.5) {
        recommendations.push({
          type: 'imbalance',
          priority: 'medium',
          title: `Imbalanced categories in ${col}`,
          message: `${topValues[0][0]} dominates with ${((topValues[0][1] / totalRows) * 100).toFixed(0)}% of values.`,
          action: `Review category balance for ${col}`,
          metric: col
        });
      }
    }

    return recommendations;
  }

  analyzeCorrelations(dataset, numericCols) {
    const recommendations = [];
    const rows = dataset.rows || [];

    if (numericCols.length < 2) return recommendations;

    const correlations = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const x = rows.map(r => toNumber(r[numericCols[i]])).filter(v => v !== null);
        const y = rows.map(r => toNumber(r[numericCols[j]])).filter(v => v !== null);
        
        if (x.length < 5 || y.length < 5 || x.length !== y.length) continue;

        const correlation = this.calculatePearson(x, y);
        if (correlation) {
          correlations.push({
            cols: [numericCols[i], numericCols[j]],
            value: correlation
          });
        }
      }
    }

    for (const corr of correlations) {
      const absCorr = Math.abs(corr.value);
      if (absCorr > 0.7) {
        recommendations.push({
          type: 'correlation',
          priority: 'high',
          title: `Strong correlation detected`,
          message: `${corr.cols[0]} and ${corr.cols[1]} have ${corr.value > 0 ? 'positive' : 'negative'} correlation (${corr.value.toFixed(2)}).`,
          action: `Consider removing one of ${corr.cols.join(' and ')}`,
          metric: corr.cols.join('_')
        });
      }
    }

    return recommendations;
  }

  analyzeDataQuality(dataset) {
    const recommendations = [];
    const rows = dataset.rows || [];
    const columns = dataset.columns || [];

    const missingByColumn = {};
    columns.forEach(col => {
      const missing = rows.filter(r => r[col.name] === null || r[col.name] === '').length;
      missingByColumn[col.name] = missing;
    });

    for (const [col, missing] of Object.entries(missingByColumn)) {
      const missingRate = missing / rows.length;
      if (missingRate > 0.1 && missingRate <= 0.5) {
        recommendations.push({
          type: 'missing_data',
          priority: 'medium',
          title: `Missing values in ${col}`,
          message: `${col} has ${(missingRate * 100).toFixed(0)}% missing data. Consider imputation.`,
          action: `Apply imputation to ${col}`,
          metric: col
        });
      } else if (missingRate > 0.5) {
        recommendations.push({
          type: 'missing_data',
          priority: 'high',
          title: `High missing rate in ${col}`,
          message: `${col} has ${(missingRate * 100).toFixed(0)}% missing data. Consider dropping column.`,
          action: `Drop ${col} or collect more data`,
          metric: col
        });
      }
    }

    return recommendations;
  }

  calculateStats(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return {
      n,
      mean,
      median: values[Math.floor(n / 2)],
      std: Math.sqrt(variance),
      min: values[0],
      max: values[n - 1]
    };
  }

  calculateSkewness(values) {
    if (values.length < 3) return 0;
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n);
    
    const skewness = values.reduce((a, b) => a + Math.pow((b - mean) / std, 3), 0) / n;
    return skewness;
  }

  detectOutliers(values) {
    if (values.length < 10) return false;
    values.sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    
    return values.some(v => v < lower || v > upper);
  }

  calculatePearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return null;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((a, b) => a + b * b, 0);
    const sumY2 = y.slice(0, n).reduce((a, b) => a + b * b, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return den === 0 ? null : num / den;
  }
}

export const recommendationEngine = new RecommendationEngine();