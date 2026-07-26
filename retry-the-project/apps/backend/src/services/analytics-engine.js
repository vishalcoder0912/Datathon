export class AnalyticsEngine {
  async performStatisticalAnalysis(data) {
    return {
      mean: this.calculateMean(data),
      median: this.calculateMedian(data),
      stdDev: this.calculateStdDev(data),
      quartiles: this.calculateQuartiles(data),
    };
  }

  async performCorrelationAnalysis(data) {
    const correlationMatrix = this.calculateCorrelationMatrix(data);
    return {
      matrix: correlationMatrix,
      strongCorrelations: this.findStrongCorrelations(correlationMatrix),
    };
  }

  calculateMean(data) {
    if (!data || data.length === 0) return [];
    const cols = data[0].length;
    return Array.from({ length: cols }, (_, col) =>
      data.reduce((sum, row) => sum + row[col], 0) / data.length
    );
  }

  calculateMedian(data) {
    if (!data || data.length === 0) return [];
    const cols = data[0].length;
    return Array.from({ length: cols }, (_, col) => {
      const column = data.map(row => row[col]).sort((a, b) => a - b);
      const mid = Math.floor(column.length / 2);
      return column.length % 2
        ? column[mid]
        : (column[mid - 1] + column[mid]) / 2;
    });
  }

  calculateStdDev(data) {
    if (!data || data.length === 0) return [];
    const means = this.calculateMean(data);
    return means.map((mean, col) => {
      const variance =
        data.reduce((sum, row) => sum + Math.pow(row[col] - mean, 2), 0) /
        data.length;
      return Math.sqrt(variance);
    });
  }

  calculateQuartiles(data) {
    if (!data || data.length === 0) return [];
    const cols = data[0].length;
    return Array.from({ length: cols }, (_, col) => {
      const column = data.map(row => row[col]).sort((a, b) => a - b);
      const q1Index = Math.floor(column.length * 0.25);
      const q3Index = Math.floor(column.length * 0.75);
      return {
        q1: column[q1Index],
        q3: column[q3Index],
        iqr: column[q3Index] - column[q1Index],
      };
    });
  }

  calculateCorrelationMatrix(data) {
    if (!data || data.length === 0) return [];
    const n = data.length;
    const cols = data[0].length;
    const means = this.calculateMean(data);
    const stdDevs = this.calculateStdDev(data);

    const matrix = [];
    for (let i = 0; i < cols; i++) {
      matrix[i] = [];
      for (let j = 0; j < cols; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const covariance =
            data.reduce(
              (sum, row) =>
                sum + (row[i] - means[i]) * (row[j] - means[j]),
              0
            ) / n;
          matrix[i][j] = covariance / (stdDevs[i] * stdDevs[j]);
        }
      }
    }
    return matrix;
  }

  findStrongCorrelations(matrix) {
    const correlations = [];
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix[i].length; j++) {
        if (Math.abs(matrix[i][j]) > 0.7) {
          correlations.push({
            var1: i,
            var2: j,
            correlation: matrix[i][j],
          });
        }
      }
    }
    return correlations;
  }
}