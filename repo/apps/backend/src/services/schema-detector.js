export const DataTypePatterns = {
  SALES: {
    keywords: ['sales', 'revenue', 'profit', 'income', 'amount', 'quantity', 'units', 'orders', 'transactions', 'customer', 'region', 'territory'],
    requiredFields: ['revenue', 'sales', 'amount', 'profit'],
    dimensions: ['region', 'month', 'date', 'category', 'product', 'customer', 'channel', 'territory', 'year', 'quarter'],
    metrics: ['revenue', 'sales', 'profit', 'quantity', 'units', 'amount', 'margin', 'growth']
  },
  INVENTORY: {
    keywords: ['inventory', 'stock', 'sku', 'product', 'warehouse', 'quantity', 'units', ' reorder'],
    requiredFields: ['quantity', 'stock', 'sku'],
    dimensions: ['product', 'sku', 'warehouse', 'category', 'location'],
    metrics: ['quantity', 'stock', 'reorder_level', 'turnover']
  },
  MARKETING: {
    keywords: ['campaign', 'ad', 'impression', 'click', 'conversion', 'ctr', 'roi', 'cost', 'lead', 'traffic'],
    requiredFields: ['impressions', 'clicks', 'cost', 'conversions'],
    dimensions: ['campaign', 'channel', 'source', 'medium', 'date', 'audience'],
    metrics: ['impressions', 'clicks', 'ctr', 'conversions', 'cost', 'roi']
  },
  FINANCE: {
    keywords: ['expense', 'budget', 'cost', 'income', 'balance', 'debit', 'credit', 'asset', 'liability'],
    requiredFields: ['amount', 'balance'],
    dimensions: ['account', 'category', 'department', 'date'],
    metrics: ['amount', 'balance', 'debit', 'credit']
  },
  HR: {
    keywords: ['employee', 'salary', 'department', 'hire', 'turnover', 'leave', 'performance'],
    requiredFields: ['employee', 'salary'],
    dimensions: ['department', 'role', 'location', 'date'],
    metrics: ['salary', 'headcount', 'turnover', 'performance']
  },
  GENERAL: {
    keywords: [],
    requiredFields: [],
    dimensions: [],
    metrics: []
  }
};

export const SalesChartRecommendations = {
  timeSeries: {
    conditions: ['has_date_column', 'has_numeric_metric'],
    charts: [
      { type: 'line', title: 'Trend Over Time', xKey: 'date', yKey: 'metric', description: 'Shows trends over time' },
      { type: 'area', title: 'Cumulative Performance', xKey: 'date', yKey: 'metric', description: 'Shows cumulative growth' }
    ]
  },
  categoryComparison: {
    conditions: ['has_category_column', 'has_numeric_metric'],
    charts: [
      { type: 'bar', title: 'Performance by Category', xKey: 'category', yKey: 'metric', description: 'Compare values across categories' },
      { type: 'horizontal-bar', title: 'Top Categories', xKey: 'category', yKey: 'metric', description: 'Ranked category performance' }
    ]
  },
  distribution: {
    conditions: ['has_numeric_column'],
    charts: [
      { type: 'histogram', title: 'Distribution Analysis', xKey: 'bin', yKey: 'count', description: 'Show data distribution' },
      { type: 'box', title: 'Statistical Distribution', xKey: 'category', yKey: 'metric', description: 'Show min, max, median' }
    ]
  },
  partToWhole: {
    conditions: ['has_category_column', 'has_multiple_categories'],
    charts: [
      { type: 'pie', title: 'Share by Category', xKey: 'category', yKey: 'metric', description: 'Show percentage contribution' },
      { type: 'doughnut', title: 'Revenue Distribution', xKey: 'category', yKey: 'metric', description: 'Show breakdown' },
      { type: 'treemap', title: 'Hierarchical Breakdown', xKey: 'category', yKey: 'metric', description: 'Show nested proportions' }
    ]
  },
  geographic: {
    conditions: ['has_region_column'],
    charts: [
      { type: 'map', title: 'Geographic Distribution', xKey: 'region', yKey: 'metric', description: 'Show regional performance' },
      { type: 'bar', title: 'Regional Comparison', xKey: 'region', yKey: 'metric', description: 'Compare across regions' }
    ]
  },
  correlation: {
    conditions: ['has_multiple_numeric_columns'],
    charts: [
      { type: 'scatter', title: 'Correlation Analysis', xKey: 'metric1', yKey: 'metric2', description: 'Show relationship between metrics' },
      { type: 'heatmap', title: 'Correlation Matrix', xKey: 'metric1', yKey: 'metric2', description: 'Show all correlations' }
    ]
  },
  ranking: {
    conditions: ['has_category_column', 'top_n'],
    charts: [
      { type: 'bar', title: 'Top N Performers', xKey: 'category', yKey: 'metric', description: 'Ranked top performers' },
      { type: 'rank-bar', title: 'Bottom N Performers', xKey: 'category', yKey: 'metric', description: 'Identify underperformers' }
    ]
  }
};

export function detectDataType(columns, rows) {
  const columnNames = columns.map(c => c.name.toLowerCase());
  const columnTypes = columns.reduce((acc, c) => {
    acc[c.name.toLowerCase()] = c.type;
    return acc;
  }, {});

  let bestMatch = { type: 'GENERAL', score: 0, confidence: 'low' };

  for (const [dataType, pattern] of Object.entries(DataTypePatterns)) {
    if (dataType === 'GENERAL') continue;

    let score = 0;
    let matches = 0;

    for (const keyword of pattern.keywords) {
      const found = columnNames.some(name => name.includes(keyword));
      if (found) {
        score += 1;
        matches++;
      }
    }

    const requiredMatches = pattern.requiredFields.filter(
      field => columnNames.some(name => name.includes(field))
    ).length;
    
    const requiredScore = requiredMatches / pattern.requiredFields.length;
    if (pattern.requiredFields.length > 0) {
      score += requiredScore * 3;
    }

    if (score > bestMatch.score) {
      bestMatch = {
        type: dataType,
        score,
        confidence: score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low'
      };
    }
  }

  return bestMatch;
}

export function detectSalesSchema(columns, rows) {
  const columnNames = columns.map(c => c.name.toLowerCase());
  const result = {
    dataType: 'SALES',
    detectedAt: new Date().toISOString(),
    primaryDimension: null,
    secondaryDimension: null,
    primaryMetric: null,
    secondaryMetric: null,
    dateColumns: [],
    categoryColumns: [],
    numericColumns: [],
    recommendedCharts: [],
    insights: [],
    dataTypeLabel: 'Sales Data'
  };

  const dataTypeLabels = {
    SALES: 'Sales Data',
    INVENTORY: 'Inventory Data',
    MARKETING: 'Marketing Data',
    FINANCE: 'Finance Data',
    HR: 'HR Data',
    GENERAL: 'Generic Data'
  };
  result.dataTypeLabel = dataTypeLabels[result.dataType] || 'Generic Data';

  for (const col of columns) {
    const name = col.name.toLowerCase();
    const type = col.type;

    if (['date', 'datetime', 'timestamp'].includes(type) || name.includes('date') || name.includes('month') || name.includes('year') || name.includes('quarter')) {
      result.dateColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
    } else if (name.includes('region') || name.includes('territory') || name.includes('location') || name.includes('country') || name.includes('city')) {
      result.categoryColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
      if (!result.secondaryDimension) result.secondaryDimension = col.name;
    } else if (name.includes('category') || name.includes('product') || name.includes('channel') || name.includes('segment')) {
      result.categoryColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
      if (!result.secondaryDimension && result.primaryDimension) result.secondaryDimension = col.name;
    } else if (type === 'number' || type === 'integer') {
      result.numericColumns.push(col.name);
      if (name.includes('revenue') || name.includes('sales') || name.includes('profit') || name.includes('amount')) {
        if (!result.primaryMetric) result.primaryMetric = col.name;
        else if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (!result.primaryMetric) {
        result.primaryMetric = col.name;
      } else if (!result.secondaryMetric) {
        result.secondaryMetric = col.name;
      }
    }
  }

  return result;
}

export function detectInventorySchema(columns, rows) {
  const result = {
    dataType: 'INVENTORY',
    detectedAt: new Date().toISOString(),
    primaryDimension: null,
    secondaryDimension: null,
    primaryMetric: null,
    secondaryMetric: null,
    dateColumns: [],
    categoryColumns: [],
    numericColumns: [],
    recommendedCharts: [],
    insights: [],
    dataTypeLabel: 'Inventory Data'
  };

  for (const col of columns) {
    const name = col.name.toLowerCase();
    const type = col.type;

    if (['date', 'datetime', 'timestamp'].includes(type) || name.includes('date') || name.includes('period')) {
      result.dateColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
    } else if (name.includes('sku') || name.includes('product') || name.includes('item') || name.includes('name')) {
      result.categoryColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
    } else if (name.includes('warehouse') || name.includes('location') || name.includes('store') || name.includes('branch')) {
      result.categoryColumns.push(col.name);
      if (!result.secondaryDimension) result.secondaryDimension = col.name;
    } else if (type === 'number' || type === 'integer') {
      result.numericColumns.push(col.name);
      if (name.includes('quantity') || name.includes('stock') || name.includes('inventory') || name.includes('units')) {
        if (!result.primaryMetric) result.primaryMetric = col.name;
        else if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (name.includes('reorder') || name.includes('safety') || name.includes('threshold')) {
        if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (!result.primaryMetric) {
        result.primaryMetric = col.name;
      }
    }
  }

  return result;
}

export function detectMarketingSchema(columns, rows) {
  const result = {
    dataType: 'MARKETING',
    detectedAt: new Date().toISOString(),
    primaryDimension: null,
    secondaryDimension: null,
    primaryMetric: null,
    secondaryMetric: null,
    dateColumns: [],
    categoryColumns: [],
    numericColumns: [],
    recommendedCharts: [],
    insights: [],
    dataTypeLabel: 'Marketing Data'
  };

  for (const col of columns) {
    const name = col.name.toLowerCase();
    const type = col.type;

    if (['date', 'datetime', 'timestamp'].includes(type) || name.includes('date') || name.includes('month') || name.includes('week')) {
      result.dateColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
    } else if (name.includes('campaign') || name.includes('channel') || name.includes('source') || name.includes('medium')) {
      result.categoryColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
      if (!result.secondaryDimension) result.secondaryDimension = col.name;
    } else if (name.includes('ad') || name.includes('audience') || name.includes('segment')) {
      result.categoryColumns.push(col.name);
    } else if (type === 'number' || type === 'integer') {
      result.numericColumns.push(col.name);
      if (name.includes('impression') || name.includes('click') || name.includes('conversion') || name.includes('cost') || name.includes('ctr') || name.includes('roi')) {
        if (!result.primaryMetric) result.primaryMetric = col.name;
        else if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (name.includes('spend') || name.includes('budget')) {
        if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (!result.primaryMetric) {
        result.primaryMetric = col.name;
      }
    }
  }

  return result;
}

export function detectFinanceSchema(columns, rows) {
  const result = {
    dataType: 'FINANCE',
    detectedAt: new Date().toISOString(),
    primaryDimension: null,
    secondaryDimension: null,
    primaryMetric: null,
    secondaryMetric: null,
    dateColumns: [],
    categoryColumns: [],
    numericColumns: [],
    recommendedCharts: [],
    insights: [],
    dataTypeLabel: 'Finance Data'
  };

  for (const col of columns) {
    const name = col.name.toLowerCase();
    const type = col.type;

    if (['date', 'datetime', 'timestamp'].includes(type) || name.includes('date') || name.includes('month') || name.includes('year') || name.includes('quarter') || name.includes('period')) {
      result.dateColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
    } else if (name.includes('account') || name.includes('category') || name.includes('department') || name.includes('type')) {
      result.categoryColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
      if (!result.secondaryDimension) result.secondaryDimension = col.name;
    } else if (name.includes('vendor') || name.includes('supplier') || name.includes('description')) {
      result.categoryColumns.push(col.name);
    } else if (type === 'number' || type === 'integer') {
      result.numericColumns.push(col.name);
      if (name.includes('amount') || name.includes('expense') || name.includes('cost') || name.includes('income') || name.includes('revenue') || name.includes('budget')) {
        if (!result.primaryMetric) result.primaryMetric = col.name;
        else if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (name.includes('balance')) {
        if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (!result.primaryMetric) {
        result.primaryMetric = col.name;
      }
    }
  }

  return result;
}

export function detectHRSchema(columns, rows) {
  const result = {
    dataType: 'HR',
    detectedAt: new Date().toISOString(),
    primaryDimension: null,
    secondaryDimension: null,
    primaryMetric: null,
    secondaryMetric: null,
    dateColumns: [],
    categoryColumns: [],
    numericColumns: [],
    recommendedCharts: [],
    insights: [],
    dataTypeLabel: 'HR Data'
  };

  for (const col of columns) {
    const name = col.name.toLowerCase();
    const type = col.type;

    if (['date', 'datetime', 'timestamp'].includes(type) || name.includes('date') || name.includes('hire') || name.includes('join') || name.includes('birth')) {
      result.dateColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
    } else if (name.includes('department') || name.includes('role') || name.includes('position') || name.includes('title') || name.includes('level')) {
      result.categoryColumns.push(col.name);
      if (!result.primaryDimension) result.primaryDimension = col.name;
      if (!result.secondaryDimension) result.secondaryDimension = col.name;
    } else if (name.includes('location') || name.includes('office') || name.includes('branch') || name.includes('team')) {
      result.categoryColumns.push(col.name);
    } else if (name.includes('employee') || name.includes('name') || name.includes('id')) {
      result.categoryColumns.push(col.name);
    } else if (type === 'number' || type === 'integer') {
      result.numericColumns.push(col.name);
      if (name.includes('salary') || name.includes('compensation') || name.includes('bonus') || name.includes('benefit')) {
        if (!result.primaryMetric) result.primaryMetric = col.name;
        else if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (name.includes('age') || name.includes('experience') || name.includes('years')) {
        if (!result.secondaryMetric) result.secondaryMetric = col.name;
      } else if (!result.primaryMetric) {
        result.primaryMetric = col.name;
      }
    }
  }

  return result;
}

export function generateChartRecommendations(schema, rows) {
  const recommendations = [];
  const hasDate = schema.dateColumns.length > 0;
  const hasCategory = schema.categoryColumns.length > 0;
  const hasNumeric = schema.numericColumns.length > 0;
  const numericCount = schema.numericColumns.length;

  if (hasDate && hasNumeric) {
    recommendations.push({
      type: 'line',
      title: `${schema.primaryMetric || 'Value'} Over Time`,
      xKey: schema.dateColumns[0],
      yKey: schema.primaryMetric,
      data: generateTimeSeriesData(rows, schema.dateColumns[0], schema.primaryMetric),
      priority: 'high',
      reason: 'Time series data detected - ideal for trend analysis'
    });

    recommendations.push({
      type: 'area',
      title: `Cumulative ${schema.primaryMetric || 'Metric'}`,
      xKey: schema.dateColumns[0],
      yKey: schema.primaryMetric,
      data: generateTimeSeriesData(rows, schema.dateColumns[0], schema.primaryMetric, 'cumulative'),
      priority: 'medium',
      reason: 'Shows growth trajectory over time'
    });
  }

  if (hasCategory && hasNumeric) {
    const categoryCol = schema.categoryColumns[0];
    const categoryData = aggregateByCategory(rows, categoryCol, schema.primaryMetric);
    
    recommendations.push({
      type: 'bar',
      title: `${schema.primaryMetric} by ${categoryCol}`,
      xKey: categoryCol,
      yKey: 'total',
      data: categoryData.sort((a, b) => b.total - a.total).slice(0, 10),
      priority: 'high',
      reason: 'Category comparison - shows top performers'
    });

    if (categoryData.length <= 6) {
      recommendations.push({
        type: 'pie',
        title: `${schema.primaryMetric} Distribution`,
        xKey: categoryCol,
        yKey: 'total',
        data: categoryData,
        priority: 'medium',
        reason: 'Part-to-whole visualization for small number of categories'
      });
    }
  }

  if (hasNumeric && numericCount >= 2) {
    recommendations.push({
      type: 'scatter',
      title: `${schema.primaryMetric} vs ${schema.secondaryMetric}`,
      xKey: schema.primaryMetric,
      yKey: schema.secondaryMetric,
      data: rows.slice(0, 100).map(row => ({
        x: Number(row[schema.primaryMetric]) || 0,
        y: Number(row[schema.secondaryMetric]) || 0
      })),
      priority: 'medium',
      reason: 'Correlation analysis between two metrics'
    });
  }

  if (hasCategory && schema.categoryColumns.length >= 2) {
    const pivotData = generatePivotData(rows, schema.categoryColumns[0], schema.categoryColumns[1], schema.primaryMetric);
    recommendations.push({
      type: 'heatmap',
      title: `${schema.categoryColumns[0]} vs ${schema.categoryColumns[1]}`,
      xKey: schema.categoryColumns[0],
      yKey: schema.categoryColumns[1],
      zKey: 'value',
      data: pivotData,
      priority: 'low',
      reason: 'Cross-category analysis'
    });
  }

  if (hasNumeric) {
    recommendations.push({
      type: 'histogram',
      title: `${schema.primaryMetric} Distribution`,
      xKey: 'range',
      yKey: 'count',
      data: generateHistogramData(rows, schema.primaryMetric),
      priority: 'medium',
      reason: 'Statistical distribution of values'
    });
  }

  return recommendations;
}

function generateTimeSeriesData(rows, dateCol, metricCol, mode = 'normal') {
  const grouped = {};
  
  rows.forEach(row => {
    const date = row[dateCol];
    const value = Number(row[metricCol]) || 0;
    if (!grouped[date]) grouped[date] = 0;
    grouped[date] += value;
  });

  const result = Object.entries(grouped).map(([date, value]) => ({
    [dateCol]: date,
    [metricCol]: mode === 'cumulative' ? value : value
  }));

  if (mode === 'cumulative') {
    let sum = 0;
    result.forEach(item => {
      sum += item[metricCol];
      item[metricCol] = sum;
    });
  }

  return result;
}

function aggregateByCategory(rows, categoryCol, metricCol) {
  const grouped = {};
  
  rows.forEach(row => {
    const category = row[categoryCol];
    const value = Number(row[metricCol]) || 0;
    if (!grouped[category]) grouped[category] = 0;
    grouped[category] += value;
  });

  return Object.entries(grouped).map(([category, total]) => ({
    [categoryCol]: category,
    total
  }));
}

function generateHistogramData(rows, metricCol) {
  const values = rows.map(row => Number(row[metricCol])).filter(v => !isNaN(v));
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
  const binSize = (max - min) / binCount;

  const bins = Array(binCount).fill(0).map((_, i) => ({
    range: `${(min + i * binSize).toFixed(0)}-${(min + (i + 1) * binSize).toFixed(0)}`,
    count: 0,
    min: min + i * binSize,
    max: min + (i + 1) * binSize
  }));

  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[binIndex].count++;
  });

  return bins;
}

function generatePivotData(rows, rowCol, colCol, metricCol) {
  const pivot = {};
  
  rows.forEach(row => {
    const rowKey = row[rowCol];
    const colKey = row[colCol];
    const value = Number(row[metricCol]) || 0;
    
    if (!pivot[rowKey]) pivot[rowKey] = {};
    if (!pivot[rowKey][colKey]) pivot[rowKey][colKey] = 0;
    pivot[rowKey][colKey] += value;
  });

  const result = [];
  Object.entries(pivot).forEach(([rowKey, cols]) => {
    Object.entries(cols).forEach(([colKey, value]) => {
      result.push({
        [rowCol]: rowKey,
        [colCol]: colKey,
        value
      });
    });
  });

  return result;
}

export function generateSalesInsights(schema, rows, chartRecommendations) {
  const insights = [];

  if (!schema.primaryMetric || !schema.primaryDimension) {
    insights.push({
      type: 'warning',
      message: 'Incomplete schema - unable to generate full analytics'
    });
    return insights;
  }

  const totalValue = rows.reduce((sum, row) => sum + (Number(row[schema.primaryMetric]) || 0), 0);
  const avgValue = totalValue / rows.length;

  insights.push({
    type: 'summary',
    title: 'Overview',
    metrics: {
      totalRecords: rows.length,
      totalValue: Math.round(totalValue * 100) / 100,
      averageValue: Math.round(avgValue * 100) / 100,
      primaryMetric: schema.primaryMetric,
      primaryDimension: schema.primaryDimension
    }
  });

  if (schema.categoryColumns.length > 0) {
    const categoryCol = schema.categoryColumns[0];
    const categoryTotals = {};
    
    rows.forEach(row => {
      const cat = row[categoryCol];
      const value = Number(row[schema.primaryMetric]) || 0;
      if (!categoryTotals[cat]) categoryTotals[cat] = 0;
      categoryTotals[cat] += value;
    });

    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topCategory = sorted[0];
    const bottomCategory = sorted[sorted.length - 1];

    insights.push({
      type: 'top_performer',
      title: 'Top Performer',
      message: `${topCategory[0]} leads with ${Math.round(topCategory[1] * 100) / 100} (${Math.round(topCategory[1] / totalValue * 100)}% of total)`,
      metric: topCategory[1],
      category: topCategory[0]
    });

    if (sorted.length > 1) {
      const top3 = sorted.slice(0, 3);
      const top3Total = top3.reduce((sum, [, v]) => sum + v, 0);
      insights.push({
        type: 'concentration',
        title: 'Concentration Analysis',
        message: `Top 3 ${categoryCol} accounts for ${Math.round(top3Total / totalValue * 100)}% of total ${schema.primaryMetric}`,
        percentage: Math.round(top3Total / totalValue * 100)
      });
    }
  }

  if (schema.dateColumns.length > 0) {
    const dateCol = schema.dateColumns[0];
    const timePeriods = {};
    
    rows.forEach(row => {
      const period = row[dateCol];
      const value = Number(row[schema.primaryMetric]) || 0;
      if (!timePeriods[period]) timePeriods[period] = 0;
      timePeriods[period] += value;
    });

    const sorted = Object.entries(timePeriods).sort((a, b) => a[0].localeCompare(b[0]));
    if (sorted.length >= 2) {
      const first = sorted[0][1];
      const last = sorted[sorted.length - 1][1];
      const growth = ((last - first) / first * 100);
      
      insights.push({
        type: 'trend',
        title: 'Trend Analysis',
        message: growth > 0 ? `Growing by ${Math.round(growth)}% from first to last period` : `Declining by ${Math.abs(Math.round(growth))}% from first to last period`,
        growth: Math.round(growth * 100) / 100
      });
    }
  }

  if (schema.numericColumns.length >= 2) {
    const correlations = [];
    for (let i = 0; i < schema.numericColumns.length; i++) {
      for (let j = i + 1; j < schema.numericColumns.length; j++) {
        const col1 = schema.numericColumns[i];
        const col2 = schema.numericColumns[j];
        const correlation = calculateCorrelation(rows, col1, col2);
        if (Math.abs(correlation) > 0.5) {
          correlations.push({
            columns: [col1, col2],
            coefficient: correlation,
            strength: Math.abs(correlation) > 0.7 ? 'strong' : 'moderate'
          });
        }
      }
    }
    
    if (correlations.length > 0) {
      insights.push({
        type: 'correlation',
        title: 'Key Correlations Found',
        message: `${correlations.length} significant correlation(s) detected between metrics`,
        correlations
      });
    }
  }

  return insights;
}

function calculateCorrelation(rows, col1, col2) {
  const pairs = rows
    .map(row => [Number(row[col1]), Number(row[col2])])
    .filter(([a, b]) => !isNaN(a) && !isNaN(b));

  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const sumX = pairs.reduce((s, [x]) => s + x, 0);
  const sumY = pairs.reduce((s, [, y]) => s + y, 0);
  const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0);
  const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0);
  const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

export function buildEnhancedSchema(columns, rows) {
  const dataTypeInfo = detectDataType(columns, rows);
  
  let schema;
  const dataTypeLabels = {
    SALES: 'Sales Data',
    INVENTORY: 'Inventory Data',
    MARKETING: 'Marketing Data',
    FINANCE: 'Finance Data',
    HR: 'HR Data',
    GENERAL: 'Generic Data'
  };

  switch (dataTypeInfo.type) {
    case 'SALES':
      schema = detectSalesSchema(columns, rows);
      break;
    case 'INVENTORY':
      schema = detectInventorySchema(columns, rows);
      break;
    case 'MARKETING':
      schema = detectMarketingSchema(columns, rows);
      break;
    case 'FINANCE':
      schema = detectFinanceSchema(columns, rows);
      break;
    case 'HR':
      schema = detectHRSchema(columns, rows);
      break;
    default:
      schema = {
        dataType: dataTypeInfo.type,
        detectedAt: new Date().toISOString(),
        confidence: dataTypeInfo.confidence,
        primaryDimension: null,
        secondaryDimension: null,
        primaryMetric: null,
        secondaryMetric: null,
        dateColumns: [],
        categoryColumns: [],
        numericColumns: [],
        recommendedCharts: [],
        insights: [],
        dataTypeLabel: 'Generic Data',
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          role: ['number', 'integer'].includes(col.type) ? 'metric' : 'dimension'
        }))
      };
      for (const col of columns) {
        const name = col.name.toLowerCase();
        if (col.type === 'date' || name.includes('date')) {
          schema.dateColumns.push(col.name);
          if (!schema.primaryDimension) schema.primaryDimension = col.name;
        } else if (col.type !== 'number') {
          schema.categoryColumns.push(col.name);
          if (!schema.primaryDimension) schema.primaryDimension = col.name;
          if (!schema.secondaryDimension) schema.secondaryDimension = col.name;
        } else {
          schema.numericColumns.push(col.name);
          if (!schema.primaryMetric) schema.primaryMetric = col.name;
          else if (!schema.secondaryMetric) schema.secondaryMetric = col.name;
        }
      }
  }

  schema.dataTypeInfo = dataTypeInfo;
  schema.dataTypeLabel = dataTypeLabels[schema.dataType] || 'Generic Data';
  schema.recommendedCharts = generateChartRecommendations(schema, rows);
  schema.insights = generateTypeSpecificInsights(schema, rows, dataTypeInfo.type);

  return schema;
}

function generateTypeSpecificInsights(schema, rows, dataType) {
  const insights = [];
  
  if (!schema.primaryMetric || !schema.primaryDimension) {
    insights.push({
      type: 'warning',
      message: 'Incomplete schema - unable to generate full analytics'
    });
    return insights;
  }

  const totalValue = rows.reduce((sum, row) => sum + (Number(row[schema.primaryMetric]) || 0), 0);
  const avgValue = totalValue / rows.length;
  const rowCount = rows.length;

  insights.push({
    type: 'summary',
    title: 'Overview',
    dataType,
    metrics: {
      totalRecords: rowCount,
      totalValue: Math.round(totalValue * 100) / 100,
      averageValue: Math.round(avgValue * 100) / 100,
      primaryMetric: schema.primaryMetric,
      primaryDimension: schema.primaryDimension
    }
  });

  if (schema.categoryColumns.length > 0) {
    const categoryCol = schema.categoryColumns[0];
    const categoryTotals = {};
    
    rows.forEach(row => {
      const cat = row[categoryCol];
      const value = Number(row[schema.primaryMetric]) || 0;
      if (!categoryTotals[cat]) categoryTotals[cat] = 0;
      categoryTotals[cat] += value;
    });

    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topCategory = sorted[0];
    
    if (topCategory) {
      insights.push({
        type: 'top_performer',
        title: dataType === 'HR' ? 'Highest Paid' : dataType === 'MARKETING' ? 'Best Performing' : 'Top Performer',
        message: `${topCategory[0]} leads with ${Math.round(topCategory[1] * 100) / 100} (${Math.round(topCategory[1] / totalValue * 100)}% of total)`,
        metric: topCategory[1],
        category: topCategory[0]
      });
    }
  }

  if (schema.numericColumns.length >= 2) {
    const correlations = [];
    for (let i = 0; i < Math.min(schema.numericColumns.length, 3); i++) {
      for (let j = i + 1; j < Math.min(schema.numericColumns.length, 3); j++) {
        const col1 = schema.numericColumns[i];
        const col2 = schema.numericColumns[j];
        const correlation = calculateCorrelation(rows, col1, col2);
        if (Math.abs(correlation) > 0.3) {
          correlations.push({
            columns: [col1, col2],
            coefficient: Math.round(correlation * 1000) / 1000,
            strength: Math.abs(correlation) > 0.6 ? 'strong' : 'moderate'
          });
        }
      }
    }
    
    if (correlations.length > 0) {
      insights.push({
        type: 'correlation',
        title: 'Key Correlations',
        message: `${correlations.length} correlation(s) detected between metrics`,
        correlations
      });
    }
  }

  const typeSpecificMessages = {
    INVENTORY: generateInventoryInsights(schema, rows),
    MARKETING: generateMarketingInsights(schema, rows),
    FINANCE: generateFinanceInsights(schema, rows),
    HR: generateHRInsights(schema, rows)
  };

  if (typeSpecificMessages[dataType]) {
    insights.push(...typeSpecificMessages[dataType]);
  }

  return insights;
}

function generateInventoryInsights(schema, rows) {
  const insights = [];
  const stockCol = schema.numericColumns.find(c => c.toLowerCase().includes('quantity') || c.toLowerCase().includes('stock'));
  
  if (stockCol) {
    const lowStock = rows.filter(row => Number(row[stockCol]) < 10).length;
    if (lowStock > 0) {
      insights.push({
        type: 'alert',
        title: 'Low Stock Alert',
        message: `${lowStock} items may need reordering (below threshold)`,
        alertLevel: 'warning'
      });
    }
  }
  
  return insights;
}

function generateMarketingInsights(schema, rows) {
  const insights = [];
  const clickCol = schema.numericColumns.find(c => c.toLowerCase().includes('click'));
  const impressionCol = schema.numericColumns.find(c => c.toLowerCase().includes('impression'));
  
  if (clickCol && impressionCol) {
    const ctr = rows.reduce((sum, row) => {
      const clicks = Number(row[clickCol]) || 0;
      const imps = Number(row[impressionCol]) || 0;
      return sum + (imps > 0 ? clicks / imps : 0);
    }, 0) / rows.length;
    
    insights.push({
      type: 'performance',
      title: 'Average CTR',
      message: `Click-through rate: ${(ctr * 100).toFixed(2)}%`,
      value: Math.round(ctr * 10000) / 100
    });
  }
  
  return insights;
}

function generateFinanceInsights(schema, rows) {
  const insights = [];
  const expenseCol = schema.numericColumns.find(c => c.toLowerCase().includes('expense') || c.toLowerCase().includes('cost'));
  const budgetCol = schema.numericColumns.find(c => c.toLowerCase().includes('budget'));
  
  if (expenseCol && budgetCol) {
    const overBudget = rows.filter(row => Number(row[expenseCol]) > Number(row[budgetCol])).length;
    if (overBudget > 0) {
      insights.push({
        type: 'alert',
        title: 'Budget Alert',
        message: `${overBudget} entries exceed budget`,
        alertLevel: 'warning'
      });
    }
  }
  
  return insights;
}

function generateHRInsights(schema, rows) {
  const insights = [];
  const salaryCol = schema.numericColumns.find(c => c.toLowerCase().includes('salary') || c.toLowerCase().includes('compensation'));
  const deptCol = schema.categoryColumns.find(c => c.toLowerCase().includes('department'));
  
  if (salaryCol && deptCol) {
    const deptAverages = {};
    rows.forEach(row => {
      const dept = row[deptCol];
      const salary = Number(row[salaryCol]) || 0;
      if (!deptAverages[dept]) deptAverages[dept] = { total: 0, count: 0 };
      deptAverages[dept].total += salary;
      deptAverages[dept].count += 1;
    });
    
    const avgByDept = Object.entries(deptAverages).map(([dept, data]) => ({
      department: dept,
      average: Math.round(data.total / data.count)
    })).sort((a, b) => b.average - a.average);
    
    if (avgByDept.length > 0) {
      insights.push({
        type: 'comparison',
        title: 'Department Salary Comparison',
        message: `Highest avg: ${avgByDept[0].department} ($${avgByDept[0].average.toLocaleString()})`,
        departments: avgByDept.slice(0, 3)
      });
    }
  }
  
  return insights;
}

export function classifyColumns(rows) {
  if (!rows || rows.length === 0) {
    return { numeric: [], categorical: [], datetime: [], unusable: [] };
  }

  const sample = rows[0];
  const columnStats = {};

  Object.keys(sample).forEach(key => {
    const values = rows.map(row => row[key]).filter(v => v !== null && v !== undefined && v !== '');
    const totalRows = rows.length;
    const missingRatio = 1 - (values.length / totalRows);
    const uniqueValues = new Set(values);
    const isConstant = uniqueValues.size <= 1;
    const isMostlyNumeric = values.length > 0 && values.filter(v => !isNaN(Number(v))).length / values.length > 0.7;
    const isDateLike = values.length > 0 && (typeof values[0] === 'string' && (
      values[0].match(/^\d{4}-\d{2}-\d{2}/) ||
      values[0].match(/^\d{2}\/\d{2}\/\d{4}/) ||
      values[0].match(/^\d{1,2}-[A-Za-z]{3}-\d{4}/)
    ));

    columnStats[key] = {
      missingRatio,
      isConstant,
      uniqueCount: uniqueValues.size,
      isMostlyNumeric,
      isDateLike,
      sampleValue: values[0]
    };
  });

  const numeric = [];
  const categorical = [];
  const datetime = [];
  const unusable = [];

  Object.keys(columnStats).forEach(key => {
    if (key.startsWith('__') || key.toLowerCase() === 'rowid' || key.toLowerCase() === 'id') {
      unusable.push(key);
      return;
    }
    const stats = columnStats[key];
    if (stats.isConstant || stats.missingRatio > 0.8) {
      unusable.push(key);
    } else if (stats.isDateLike || key.toLowerCase().includes('date') || key.toLowerCase().includes('year') || key.toLowerCase().includes('month')) {
      datetime.push(key);
    } else if (stats.isMostlyNumeric && stats.uniqueCount > 10) {
      numeric.push(key);
    } else {
      categorical.push(key);
    }
  });

  return { numeric, categorical, datetime, unusable };
}

function cleanNumericData(values) {
  if (values.length === 0) return [];
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v) && v !== '');
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return valid.filter(v => v >= lowerBound && v <= upperBound);
}

export function smartAutoChartGeneration(rows, columnClassification = null) {
  return smartAutoChartGenerationForSingle(rows, columnClassification);
}

function getCleanColumnClassification(rows) {
  if (!rows || rows.length === 0) {
    return { numeric: [], categorical: [], datetime: [], unusable: [] };
  }

  const sample = rows[0];
  const columnStats = {};

  Object.keys(sample).forEach(key => {
    if (key.startsWith('__')) {
      columnStats[key] = { usable: false, reason: 'system_column' };
      return;
    }
    
    const values = rows.map(row => row[key]).filter(v => v !== null && v !== undefined && v !== '');
    const totalRows = rows.length;
    const missingRatio = values.length === 0 ? 1 : 1 - (values.length / totalRows);
    
    if (missingRatio > 0.7) {
      columnStats[key] = { usable: false, reason: 'too_many_missing' };
      return;
    }

    const uniqueValues = new Set(values);
    if (uniqueValues.size <= 1) {
      columnStats[key] = { usable: false, reason: 'constant_value' };
      return;
    }

    const numericValues = values.filter(v => !isNaN(Number(v)));
    const numericRatio = numericValues.length / values.length;
    
    const isLongText = values.length > 0 && values.some(v => String(v).length > 200);
    if (isLongText && numericRatio < 0.3) {
      columnStats[key] = { usable: false, reason: 'irrelevant_text' };
      return;
    }

    const isDateLike = values.length > 0 && (
      String(values[0]).match(/^\d{4}-\d{2}-\d{2}/) ||
      String(values[0]).match(/^\d{2}\/\d{2}\/\d{4}/) ||
      key.toLowerCase().includes('date') || 
      key.toLowerCase().includes('year') || 
      key.toLowerCase().includes('month')
    );

    columnStats[key] = {
      usable: true,
      isNumeric: numericRatio > 0.5,
      isDateLike,
      uniqueCount: uniqueValues.size,
      missingRatio
    };
  });

  const numeric = [];
  const categorical = [];
  const datetime = [];

  Object.keys(columnStats).forEach(key => {
    const stats = columnStats[key];
    if (!stats.usable) return;
    
    if (stats.isDateLike) {
      datetime.push(key);
    } else if (stats.isNumeric && stats.uniqueCount > 5) {
      numeric.push(key);
    } else {
      categorical.push(key);
    }
  });

  return { numeric, categorical, datetime, unusable: [] };
}

export function smartAutoChartGenerationForSingle(rows, columnClassification = null) {
  const cols = columnClassification || getCleanColumnClassification(rows);
  const numericCols = cols.numeric;
  const categoricalCols = cols.categorical;
  
  if (numericCols.length === 0 && categoricalCols.length === 0) {
    return [];
  }

  const charts = [];
  const addedKeys = new Set();

  function isDuplicate(xKey, yKey, type) {
    const key = `${type}:${xKey}:${yKey || ''}`;
    if (addedKeys.has(key)) return true;
    addedKeys.add(key);
    return false;
  }

  function addChart(chart) {
    if (!chart || !chart.title) return false;
    if (!chart.data || chart.data.length === 0) return false;
    if (isDuplicate(chart.xKey, chart.yKey, chart.type)) return false;
    charts.push(chart);
    return true;
  }

  const salaryCol = findColumnByPattern(numericCols, ['salary', 'compensation', 'wage', 'pay', 'income', 'remuneration']);
  const experienceCol = findColumnByPattern(numericCols, ['experience', 'years', 'seniority', 'tenure', 'exp']);
  const ageCol = findColumnByPattern(numericCols, ['age', 'age_years']);
  const countryCol = findColumnByPattern(categoricalCols, ['country', 'location', 'region', 'nation', 'geo']);
  const educationCol = findColumnByPattern(categoricalCols, ['education', 'degree', 'qualification', 'qualification']);
  const companySizeCol = findColumnByPattern(categoricalCols, ['company_size', 'size', 'employees', 'staff', 'company_type']);
  const jobTitleCol = findColumnByPattern(categoricalCols, ['job_title', 'title', 'role', 'position', 'job']);
  const languageCol = findColumnByPattern(categoricalCols, ['language', 'tech', 'skills', 'technology']);
  const frameworkCol = findColumnByPattern(categoricalCols, ['framework', 'tools', 'library', 'platform']);
  const industryCol = findColumnByPattern(categoricalCols, ['industry', 'sector', 'field']);

  const distributionCharts = [];
  if (salaryCol) {
    const chart = generateHistogramChart(rows, salaryCol, 'Distribution', 'salary_dist');
    if (chart) distributionCharts.push(chart);
  }
  if (experienceCol) {
    const chart = generateHistogramChart(rows, experienceCol, 'Distribution', 'experience_dist');
    if (chart) distributionCharts.push(chart);
  }
  if (ageCol && distributionCharts.length < 2) {
    const chart = generateHistogramChart(rows, ageCol, 'Distribution', 'age_dist');
    if (chart) distributionCharts.push(chart);
  }
  distributionCharts.slice(0, 2).forEach(c => addChart(c));

  const relationshipCharts = [];
  // Skip salary vs experience scatter chart - handled by analytics engine
  // if (salaryCol && experienceCol) {
  //   const chart = generateScatterChart(rows, experienceCol, salaryCol, 'Relationship', 'salary_exp_scatter');
  //   if (chart && experienceCol !== salaryCol) relationshipCharts.push(chart);
  // }
  if (salaryCol && ageCol && ageCol !== salaryCol && ageCol !== experienceCol) {
    const chart = generateScatterChart(rows, ageCol, salaryCol, 'Relationship', 'salary_age_scatter');
    if (chart) relationshipCharts.push(chart);
  }
  for (let i = 0; i < numericCols.length && relationshipCharts.length < 2; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      if (numericCols[i] !== numericCols[j]) {
        const existingX = relationshipCharts.map(c => c.xKey);
        if (!existingX.includes(numericCols[i])) {
          const chart = generateScatterChart(rows, numericCols[i], numericCols[j], 'Relationship', `${numericCols[i]}_${numericCols[j]}_scatter`);
          if (chart) relationshipCharts.push(chart);
          break;
        }
      }
    }
  }
  relationshipCharts.slice(0, 2).forEach(c => addChart(c));

  const categoryCharts = [];
  if (countryCol && salaryCol) {
    const chart = generateCategoryBarChart(rows, countryCol, salaryCol, 'Categorical Comparison', 'salary_country_bar', 'avg');
    if (chart) categoryCharts.push(chart);
  }
  if (educationCol && salaryCol) {
    const chart = generateCategoryBarChart(rows, educationCol, salaryCol, 'Categorical Comparison', 'salary_education_bar', 'avg');
    if (chart) categoryCharts.push(chart);
  }
  if (jobTitleCol && salaryCol) {
    const chart = generateCategoryBarChart(rows, jobTitleCol, salaryCol, 'Categorical Comparison', 'salary_jobtitle_bar', 'avg');
    if (chart) categoryCharts.push(chart);
  }
  if (companySizeCol && salaryCol) {
    const chart = generateCategoryBarChart(rows, companySizeCol, salaryCol, 'Categorical Comparison', 'salary_companysize_bar', 'avg');
    if (chart) categoryCharts.push(chart);
  }
  if (industryCol && salaryCol) {
    const chart = generateCategoryBarChart(rows, industryCol, salaryCol, 'Categorical Comparison', 'salary_industry_bar', 'avg');
    if (chart) categoryCharts.push(chart);
  }
  categoryCharts.slice(0, 2).forEach(c => addChart(c));

  const freqCharts = [];
  if (languageCol) {
    const chart = generateFrequencyChart(rows, languageCol, 'Frequency', 'language_freq');
    if (chart) freqCharts.push(chart);
  }
  if (frameworkCol && freqCharts.length === 0) {
    const chart = generateFrequencyChart(rows, frameworkCol, 'Frequency', 'framework_freq');
    if (chart) freqCharts.push(chart);
  }
  if (jobTitleCol && freqCharts.length === 0) {
    const chart = generateFrequencyChart(rows, jobTitleCol, 'Frequency', 'jobtitle_freq');
    if (chart) freqCharts.push(chart);
  }
  if (countryCol && freqCharts.length === 0) {
    const chart = generateFrequencyChart(rows, countryCol, 'Frequency', 'country_freq');
    if (chart) freqCharts.push(chart);
  }
  freqCharts.slice(0, 2).forEach(c => addChart(c));

  const fallbackCharts = [];
  if (charts.length < 7 && numericCols.length >= 2) {
    for (let i = 0; i < numericCols.length && fallbackCharts.length < 3; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const xCol = numericCols[i];
        const yCol = numericCols[j];
        if (xCol !== yCol) {
          const chart = generateScatterChart(rows, xCol, yCol, 'Fallback', `fallback_${xCol}_${yCol}`);
          if (chart && addChart(chart)) {
            fallbackCharts.push(chart);
            if (charts.length >= 7) break;
          }
        }
      }
    }
  }

  if (charts.length < 7 && categoricalCols.length > 0 && numericCols.length > 0) {
    for (const catCol of categoricalCols.slice(0, 3)) {
      for (const numCol of numericCols.slice(0, 2)) {
        const chart = generateCategoryBarChart(rows, catCol, numCol, 'Fallback', `fallback_${catCol}_${numCol}`, 'avg');
        if (chart && addChart(chart)) {
          fallbackCharts.push(chart);
          if (charts.length >= 7) break;
        }
      }
      if (charts.length >= 7) break;
    }
  }

  return charts.filter(c => c && c.data && c.data.length > 0).slice(0, 10);
}

export function smartAutoChartGenerationForMerged(rows, columnClassification = null) {
  const cols = columnClassification || getCleanColumnClassification(rows);
  const numericCols = cols.numeric;
  const categoricalCols = cols.categorical;
  
  if (numericCols.length === 0 && categoricalCols.length === 0) {
    return [];
  }

  const charts = [];
  const addedKeys = new Set();

  function isDuplicate(xKey, yKey, type) {
    const key = `${type}:${xKey}:${yKey || ''}`;
    if (addedKeys.has(key)) return true;
    addedKeys.add(key);
    return false;
  }

  function addChart(chart) {
    if (!chart || !chart.title) return false;
    if (!chart.data || chart.data.length === 0) return false;
    if (isDuplicate(chart.xKey, chart.yKey, chart.type)) return false;
    charts.push(chart);
    return true;
  }

  const salaryCol = findColumnByPattern(numericCols, ['salary', 'compensation', 'wage', 'pay', 'income']);
  const experienceCol = findColumnByPattern(numericCols, ['experience', 'years', 'seniority', 'tenure']);
  const ageCol = findColumnByPattern(numericCols, ['age']);
  const countryCol = findColumnByPattern(categoricalCols, ['country', 'location', 'region', 'nation']);
  const educationCol = findColumnByPattern(categoricalCols, ['education', 'degree', 'qualification']);
  const companySizeCol = findColumnByPattern(categoricalCols, ['company_size', 'size', 'employees', 'staff']);
  const jobTitleCol = findColumnByPattern(categoricalCols, ['job_title', 'title', 'role', 'position']);
  const sourceCol = findColumnByPattern(categoricalCols, ['source', 'sourcefile', '__sourcefile']);
  const languageCol = findColumnByPattern(categoricalCols, ['language', 'tech', 'skills']);
  const frameworkCol = findColumnByPattern(categoricalCols, ['framework', 'tools', 'library']);
  const industryCol = findColumnByPattern(categoricalCols, ['industry', 'sector']);

  const distributionCharts = [];
  if (salaryCol) distributionCharts.push(generateHistogramChart(rows, salaryCol, 'Distribution', 'salary_dist_m'));
  if (experienceCol) distributionCharts.push(generateHistogramChart(rows, experienceCol, 'Distribution', 'experience_dist_m'));
  if (ageCol && distributionCharts.length < 2) distributionCharts.push(generateHistogramChart(rows, ageCol, 'Distribution', 'age_dist_m'));
  distributionCharts.slice(0, 2).forEach(c => addChart(c));

  const relationshipCharts = [];
  if (salaryCol && experienceCol) relationshipCharts.push(generateScatterChart(rows, experienceCol, salaryCol, 'Relationship', 'salary_exp_scatter_m'));
  if (salaryCol && ageCol && ageCol !== salaryCol && ageCol !== experienceCol) relationshipCharts.push(generateScatterChart(rows, ageCol, salaryCol, 'Relationship', 'salary_age_scatter_m'));
  relationshipCharts.slice(0, 2).forEach(c => addChart(c));

  const categoryCharts = [];
  if (countryCol && salaryCol) categoryCharts.push(generateCategoryBarChart(rows, countryCol, salaryCol, 'Categorical', 'salary_country_m', 'avg'));
  if (educationCol && salaryCol) categoryCharts.push(generateCategoryBarChart(rows, educationCol, salaryCol, 'Categorical', 'salary_education_m', 'avg'));
  if (jobTitleCol && salaryCol) categoryCharts.push(generateCategoryBarChart(rows, jobTitleCol, salaryCol, 'Categorical', 'salary_jobtitle_m', 'avg'));
  if (companySizeCol && salaryCol) categoryCharts.push(generateCategoryBarChart(rows, companySizeCol, salaryCol, 'Categorical', 'salary_companysize_m', 'avg'));
  if (industryCol && salaryCol) categoryCharts.push(generateCategoryBarChart(rows, industryCol, salaryCol, 'Categorical', 'salary_industry_m', 'avg'));
  categoryCharts.slice(0, 2).forEach(c => addChart(c));

  const freqCharts = [];
  if (sourceCol) freqCharts.push(generateFrequencyChart(rows, sourceCol, 'Source Analysis', 'source_count_m'));
  if (languageCol && freqCharts.length === 0) freqCharts.push(generateFrequencyChart(rows, languageCol, 'Frequency', 'language_freq_m'));
  if (frameworkCol && freqCharts.length === 0) freqCharts.push(generateFrequencyChart(rows, frameworkCol, 'Frequency', 'framework_freq_m'));
  if (jobTitleCol && freqCharts.length === 0) freqCharts.push(generateFrequencyChart(rows, jobTitleCol, 'Frequency', 'jobtitle_freq_m'));
  freqCharts.slice(0, 2).forEach(c => addChart(c));

  if (charts.length < 7 && numericCols.length >= 2) {
    for (let i = 0; i < numericCols.length && charts.length < 10; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        if (numericCols[i] !== numericCols[j]) {
          const chart = generateScatterChart(rows, numericCols[i], numericCols[j], 'Fallback', `fallback_${numericCols[i]}_${numericCols[j]}_m`);
          if (chart && addChart(chart) && charts.length >= 7) break;
        }
      }
      if (charts.length >= 7) break;
    }
  }

  if (charts.length < 7 && categoricalCols.length > 0 && numericCols.length > 0) {
    for (const catCol of categoricalCols.slice(0, 3)) {
      for (const numCol of numericCols.slice(0, 2)) {
        const chart = generateCategoryBarChart(rows, catCol, numCol, 'Fallback', `fallback_${catCol}_${numCol}_m`, 'avg');
        if (chart && addChart(chart) && charts.length >= 7) break;
      }
      if (charts.length >= 7) break;
    }
  }

  return charts.slice(0, 10);
}

function findColumnByPattern(columns, patterns) {
  for (const pattern of patterns) {
    const found = columns.find(col => col.toLowerCase().includes(pattern));
    if (found) return found;
  }
  return columns[0] || null;
}

function generateHistogramChart(rows, column, category, id) {
  const values = rows.map(r => Number(r[column])).filter(v => !isNaN(v) && v !== null);
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
  const binSize = (max - min) / binCount || 1;

  const formatBinLabel = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return Math.round(val).toLocaleString();
  };

  const bins = Array(binCount).fill(0).map((_, i) => ({
    range: `${formatBinLabel(min + i * binSize)}-${formatBinLabel(min + (i + 1) * binSize)}`,
    rangeStart: min + i * binSize,
    rangeEnd: min + (i + 1) * binSize,
    count: 0
  }));

  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[binIndex].count++;
  });

  return {
    type: 'bar',
    category,
    title: `${formatColumnName(column)} Distribution`,
    xKey: 'range',
    yKey: 'count',
    xLabel: formatColumnName(column),
    yLabel: 'Count',
    data: bins.filter(b => b.count > 0),
    id
  };
}

function cleanForOutliers(values, maxPercentile = 99) {
  if (values.length < 10) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const pLower = sorted[Math.floor(sorted.length * 0.01)] || sorted[0];
  const pUpper = sorted[Math.floor(sorted.length * maxPercentile / 100)] || sorted[sorted.length - 1];
  return values.filter(v => v >= pLower && v <= pUpper);
}

function generateScatterChart(rows, xColumn, yColumn, category, id) {
  if (xColumn === yColumn) return null;

  const rawData = rows
    .map(row => ({
      x: Number(row[xColumn]),
      y: Number(row[yColumn])
    }))
    .filter(point => !isNaN(point.x) && !isNaN(point.y) && point.x !== null && point.y !== null);

  if (rawData.length < 2) return null;

  const xVals = rawData.map(d => d.x);
  const yVals = rawData.map(d => d.y);
  const cleanX = cleanForOutliers(xVals);
  const cleanY = cleanForOutliers(yVals);

  const data = rawData
    .filter(point => cleanX.includes(point.x) && cleanY.includes(point.y))
    .slice(0, 500)
    .map(point => ({
      [xColumn]: point.x,
      [yColumn]: point.y
    }));

  if (data.length < 2) return null;

  return {
    type: 'scatter',
    category,
    title: `${formatColumnName(yColumn)} vs ${formatColumnName(xColumn)}`,
    xKey: xColumn,
    yKey: yColumn,
    xLabel: formatColumnName(xColumn),
    yLabel: formatColumnName(yColumn),
    data,
    id
  };
}

function generateCategoryBarChart(rows, categoryCol, metricCol, category, id, aggregation = 'avg') {
  const grouped = {};

  rows.forEach(row => {
    const cat = row[categoryCol];
    const val = Number(row[metricCol]);
    if (!cat || isNaN(val)) return;

    if (!grouped[cat]) {
      grouped[cat] = { sum: 0, count: 0 };
    }
    grouped[cat].sum += val;
    grouped[cat].count++;
  });

  const data = Object.entries(grouped)
    .map(([key, vals]) => ({
      [categoryCol]: key,
      value: aggregation === 'avg' ? vals.sum / vals.count : vals.sum,
      count: vals.count
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (data.length === 0) return null;

  return {
    type: 'bar',
    category,
    title: `${aggregation === 'avg' ? 'Average ' : ''}${formatColumnName(metricCol)} by ${formatColumnName(categoryCol)}`,
    xKey: categoryCol,
    yKey: 'value',
    xLabel: formatColumnName(categoryCol),
    yLabel: aggregation === 'avg' ? `Avg ${formatColumnName(metricCol)}` : formatColumnName(metricCol),
    data,
    id
  };
}

function generateFrequencyChart(rows, column, category, id) {
  const grouped = {};

  rows.forEach(row => {
    const value = row[column];
    if (!value) return;

    const items = String(value).split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    items.forEach(item => {
      grouped[item] = (grouped[item] || 0) + 1;
    });
  });

  const data = Object.entries(grouped)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (data.length === 0) return null;

  return {
    type: 'bar',
    category,
    title: `Top ${formatColumnName(column)}`,
    xKey: 'name',
    yKey: 'count',
    xLabel: formatColumnName(column),
    yLabel: 'Count',
    data,
    id
  };
}

function generateHeatmapData(rows, rowCol, colCol, metricCol, category, id) {
  const pivot = {};

  rows.forEach(row => {
    const rowKey = row[rowCol];
    const colKey = row[colCol];
    const value = Number(row[metricCol]);
    if (!rowKey || !colKey || isNaN(value)) return;

    if (!pivot[rowKey]) pivot[rowKey] = {};
    if (!pivot[rowKey][colKey]) pivot[rowKey][colKey] = { sum: 0, count: 0 };
    pivot[rowKey][colKey].sum += value;
    pivot[rowKey][colKey].count++;
  });

  const data = [];
  Object.entries(pivot).forEach(([rowKey, cols]) => {
    Object.entries(cols).forEach(([colKey, vals]) => {
      data.push({
        [rowCol]: rowKey,
        [colCol]: colKey,
        value: vals.sum / vals.count
      });
    });
  });

  if (data.length === 0) return null;

  return {
    type: 'heatmap',
    category,
    title: `${formatColumnName(rowCol)} vs ${formatColumnName(colCol)}`,
    xKey: rowCol,
    yKey: colCol,
    zKey: 'value',
    xLabel: formatColumnName(rowCol),
    yLabel: formatColumnName(colCol),
    data: data.slice(0, 50),
    id
  };
}

function formatColumnName(name) {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default {
  detectDataType,
  detectSalesSchema,
  detectInventorySchema,
  detectMarketingSchema,
  detectFinanceSchema,
  detectHRSchema,
  generateChartRecommendations,
  generateSalesInsights,
  buildEnhancedSchema,
  DataTypePatterns,
  SalesChartRecommendations,
  classifyColumns,
  smartAutoChartGeneration,
  smartAutoChartGenerationForSingle,
  smartAutoChartGenerationForMerged
};