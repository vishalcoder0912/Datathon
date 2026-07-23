import { toNumber } from '@insightflow/shared-analytics';

export class AlertService {
  constructor() {
    this.alerts = new Map();
    this.alertHistory = [];
  }

  createAlert(config) {
    const {
      id = `alert_${Date.now()}`,
      name,
      datasetId,
      condition,
      threshold,
      metric,
      operator = 'gt',
      enabled = true
    } = config;

    const alert = {
      id,
      name: name || `${metric} ${operator} ${threshold}`,
      datasetId,
      condition: condition || { metric, operator, threshold },
      enabled,
      createdAt: new Date().toISOString(),
      triggeredCount: 0,
      lastTriggered: null
    };

    this.alerts.set(id, alert);
    return alert;
  }

  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'neq': return value !== threshold;
      case 'change_gt': return value > threshold;
      case 'change_lt': return value < threshold;
      default: return false;
    }
  }

  async checkAlert(alert, dataset) {
    const { metric, operator, threshold } = alert.condition;
    
    if (!dataset?.rows) return { triggered: false };

    const values = dataset.rows.map(r => toNumber(r[metric])?.valueOf()).filter(v => v !== null);
    if (values.length === 0) return { triggered: false };

    const current = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : values[0];
    const change = previous ? ((current - previous) / previous) * 100 : 0;

    const checkValue = operator.includes('change') ? change : current;
    const triggered = this.evaluateCondition(checkValue, operator, threshold);

    if (triggered) {
      alert.triggeredCount++;
      alert.lastTriggered = new Date().toISOString();
      
      this.alertHistory.push({
        alertId: alert.id,
        timestamp: new Date().toISOString(),
        value: current,
        change,
        threshold
      });
    }

    return {
      triggered,
      current,
      change,
      threshold,
      message: triggered 
        ? `Alert: ${metric} ${operator} ${threshold} (current: ${current.toFixed(2)})`
        : null
    };
  }

  async checkAllAlerts(dataset) {
    const results = [];
    
    for (const [id, alert] of this.alerts) {
      if (!alert.enabled) continue;
      if (alert.datasetId && alert.datasetId !== dataset.id) continue;
      
      const result = await this.checkAlert(alert, dataset);
      if (result.triggered) {
        results.push({ alertId: id, ...result });
      }
    }

    return results;
  }

  async detectAnomalies(rows, column, options = {}) {
    const { threshold = 1.5 } = options;
    
    const values = rows.map(r => toNumber(r[column])?.valueOf()).filter(v => v !== null);
    if (values.length < 10) return { error: 'Insufficient data' };

    values.sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - threshold * iqr;
    const upper = q3 + threshold * iqr;

    const anomalies = [];
    rows.forEach((row, index) => {
      const value = toNumber(row[column])?.valueOf();
      if (value !== null && (value < lower || value > upper)) {
        anomalies.push({
          rowIndex: index,
          value,
          type: value < lower ? 'below' : 'above',
          deviation: value < lower ? lower - value : value - upper
        });
      }
    });

    return {
      column,
      threshold,
      bounds: { lower, upper },
      count: anomalies.length,
      percentage: ((anomalies.length / values.length) * 100).toFixed(2),
      anomalies: anomalies.slice(0, 20)
    };
  }

  createThresholdAlerts(dataset, options = {}) {
    const { sensitivity = 1.5 } = options;
    const alerts = [];
    const numericCols = dataset.columns?.filter(c => c.type === 'number') || [];
    
    for (const col of numericCols) {
      const values = dataset.rows.map(r => toNumber(r[col.name])?.valueOf()).filter(v => v !== null);
      if (values.length < 10) continue;

      values.sort((a, b) => a - b);
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const iqr = q3 - q1;
      
      const highAlert = this.createAlert({
        name: `${col.name} unusually high`,
        datasetId: dataset.id,
        metric: col.name,
        operator: 'gt',
        threshold: q3 + sensitivity * iqr
      });
      alerts.push(highAlert);

      const lowAlert = this.createAlert({
        name: `${col.name} unusually low`,
        datasetId: dataset.id,
        metric: col.name,
        operator: 'lt',
        threshold: q1 - sensitivity * iqr
      });
      alerts.push(lowAlert);
    }

    return alerts;
  }

  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  getAlerts() {
    return Array.from(this.alerts.values());
  }

  deleteAlert(alertId) {
    return this.alerts.delete(alertId);
  }

  toggleAlert(alertId, enabled) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = enabled;
      return alert;
    }
    return null;
  }
}

export const alertService = new AlertService();