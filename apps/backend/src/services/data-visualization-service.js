/**
 * Advanced Data Visualization Service
 * Generates sophisticated charts and visualizations
 */

export function generateAdvancedCharts(dataset) {
  const charts = [];

  const numericCols = dataset.columns.filter(c => c.type === "number");
  for (const col of numericCols) {
    charts.push(generateHistogram(dataset, col));
  }

  const categoricalCols = dataset.columns.filter(c => c.type === "string");
  for (const col of categoricalCols) {
    charts.push(generateCategoryChart(dataset, col));
  }

  if (numericCols.length > 1) {
    charts.push(generateCorrelationHeatmap(dataset, numericCols));
  }

  return charts.filter(Boolean);
}

function generateHistogram(dataset, column) {
  const values = dataset.rows
    .map(r => r[column.name])
    .filter(v => v !== null && v !== undefined && !isNaN(v))
    .map(Number);

  if (values.length === 0) return null;

  const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;

  const bins = Array(binCount).fill(0);
  values.forEach(val => {
    const binIdx = Math.floor((val - min) / binWidth);
    bins[Math.min(binIdx, binCount - 1)]++;
  });

  const formatNumber = (num) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  return {
    type: "histogram",
    title: `${column.name} Distribution`,
    column: column.name,
    data: bins.map((count, i) => {
      const rangeStart = min + i * binWidth;
      const rangeEnd = min + (i + 1) * binWidth;
      return {
        range: `${formatNumber(rangeStart)}-${formatNumber(rangeEnd)}`,
        rangeStart,
        rangeEnd,
        count,
      };
    }),
  };
}

function generateCategoryChart(dataset, column) {
  const freq = {};
  dataset.rows.forEach(row => {
    const val = String(row[column.name]);
    freq[val] = (freq[val] || 0) + 1;
  });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    type: "bar",
    title: `Count by ${column.name}`,
    column: column.name,
    data: sorted.map(([category, count]) => ({ category, count })),
  };
}

function generateCorrelationHeatmap(dataset, numericCols) {
  const matrix = [];

  for (let i = 0; i < numericCols.length; i++) {
    const row = [];
    for (let j = 0; j < numericCols.length; j++) {
      if (i === j) {
        row.push(1);
      } else if (i > j) {
        row.push(matrix[j][i]);
      } else {
        const x = dataset.rows.map(r => Number(r[numericCols[i].name])).filter(v => !isNaN(v));
        const y = dataset.rows.map(r => Number(r[numericCols[j].name])).filter(v => !isNaN(v));
        const corr = calculateCorrelation(x, y);
        row.push(corr);
      }
    }
    matrix.push(row);
  }

  return {
    type: "heatmap",
    title: "Correlation Matrix",
    columns: numericCols.map(c => c.name),
    matrix,
  };
}

function calculateCorrelation(x, y) {
  if (x.length < 2) return 0;
  const n = Math.min(x.length, y.length);
  const sx = x.slice(0, n);
  const sy = y.slice(0, n);

  const meanX = sx.reduce((a, b) => a + b) / n;
  const meanY = sy.reduce((a, b) => a + b) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = sx[i] - meanX;
    const dy = sy[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}
