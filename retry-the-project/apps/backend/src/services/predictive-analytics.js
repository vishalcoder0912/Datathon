import { toNumber } from '@insightflow/shared-analytics';

export class PredictiveAnalytics {
  constructor() {
    this.models = new Map();
  }

  linearRegression(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept, r2: this.calculateR2(x, y, slope, intercept) };
  }

  calculateR2(x, y, slope, intercept) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    let yMean = y.reduce((a, b) => a + b, 0) / n;
    let ssRes = 0, ssTot = 0;

    for (let i = 0; i < n; i++) {
      const yPred = slope * x[i] + intercept;
      ssRes += Math.pow(y[i] - yPred, 2);
      ssTot += Math.pow(y[i] - yMean, 2);
    }

    return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  async forecastTimeseries(rows, column, periods = 3) {
    const values = rows.map(r => toNumber(r[column])).filter(v => v !== null);
    if (values.length < 3) return { error: 'Insufficient data' };

    const x = values.map((_, i) => i);
    const regression = this.linearRegression(x, values);

    if (!regression) return { error: 'Unable to fit model' };

    const forecasts = [];
    for (let i = 1; i <= periods; i++) {
      const predicted = regression.slope * (values.length + i - 1) + regression.intercept;
      forecasts.push({
        period: i,
        predicted: Math.max(0, predicted),
        confidence: this.calculateConfidenceInterval(regression.r2, predicted)
      });
    }

    return {
      column,
      model: 'linear',
      r2: regression.r2,
      slope: regression.slope,
      intercept: regression.intercept,
      forecasts,
      trend: regression.slope > 0 ? 'increasing' : 'decreasing',
      growthRate: ((regression.slope / (values[values.length - 1] || 1)) * 100).toFixed(2)
    };
  }

  calculateConfidenceInterval(r2, predicted) {
    const confidence = Math.max(0, Math.min(100, r2 * 100));
    const margin = (predicted * (1 - r2)) / 2;
    return {
      lower: Math.max(0, predicted - margin),
      upper: predicted + margin,
      confidence: confidence.toFixed(1) + '%'
    };
  }

  calculateMovingAverage(values, window = 3) {
    if (values.length < window) return values;
    
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      result.push(avg);
    }
    return result;
  }

  async detectTrends(rows, column) {
    const values = rows.map(r => toNumber(r[column])?.valueOf()).filter(v => v !== null);
    if (values.length < 3) return { error: 'Insufficient data' };

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / (first || 1)) * 100;

    const recentValues = values.slice(-5);
    const ma3 = this.calculateMovingAverage(recentValues, 3);
    const maOverall = this.calculateMovingAverage(values, Math.min(5, Math.floor(values.length / 2)));

    return {
      column,
      summary: {
        total: values.length,
        min,
        max,
        range,
        first,
        last,
        changePercent: change.toFixed(2)
      },
      trend: {
        direction: change > 5 ? 'rising' : change < -5 ? 'falling' : 'stable',
        strength: Math.abs(change) > 20 ? 'strong' : 'moderate',
        changePercent: change.toFixed(2)
      },
      movingAverages: {
        recent: ma3[ma3.length - 1]?.toFixed(2),
        overall: maOverall[maOverall.length - 1]?.toFixed(2)
      }
    };
  }

  async calculateGrowthRate(rows, column) {
    const values = rows.map(r => toNumber(r[column])?.valueOf()).filter(v => v !== null);
    if (values.length < 2) return { error: 'Insufficient data' };

    const first = values[0];
    const last = values[values.length - 1];
    const cagr = (Math.pow(last / first, 1 / (values.length - 1)) - 1) * 100;

    const periods = [];
    for (let i = 1; i < values.length; i++) {
      const growth = ((values[i] - values[i - 1]) / (values[i - 1] || 1)) * 100;
      periods.push({ period: i, growth: growth.toFixed(2) });
    }

    return {
      column,
      cagr: cagr.toFixed(2),
      firstValue: first,
      lastValue: last,
      periods
    };
  }

  async predictNextValue(rows, column) {
    const values = rows.map(r => toNumber(r[column])?.valueOf()).filter(v => v !== null);
    if (values.length < 3) return { error: 'Insufficient data for prediction' };

    const x = values.map((_, i) => i);
    const regression = this.linearRegression(x, values);

    if (!regression) return { error: 'Prediction failed' };

    const predicted = regression.slope * values.length + regression.intercept;
    const confidence = regression.r2 > 0.7 ? 'high' : regression.r2 > 0.4 ? 'medium' : 'low';

    return {
      column,
      currentValue: last,
      predicted: Math.max(0, predicted),
      confidence,
      r2: regression.r2,
      model: 'linear_regression'
    };
  }

  async analyzeMultipleMetrics(rows, metricColumns) {
    const results = {};
    
    for (const col of metricColumns.slice(0, 5)) {
      const forecast = await this.forecastTimeseries(rows, col, 2);
      const trend = await this.detectTrends(rows, col);
      const growth = await this.calculateGrowthRate(rows, col);
      
      results[col] = { forecast, trend, growth };
    }

    return results;
  }
}

export const predictiveAnalytics = new PredictiveAnalytics();