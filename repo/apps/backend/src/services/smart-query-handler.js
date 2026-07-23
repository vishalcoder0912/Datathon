import { prepareDatasetForAnalytics, groupMetricByDimension, countRowsByDimension, buildDatasetSchema } from "@insightflow/shared-analytics";
import { buildEnhancedSchema, generateChartRecommendations } from "./schema-detector.js";

const QUERY_INTENTS = {
  GREETING: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'],
  DATASET_INFO: ['about this dataset', 'describe this dataset', 'tell me about this', 'what does this contain', 'overview of dataset', 'what is this dataset about', 'what does this data represent'],
  HIGHEST: ['highest', 'maximum', 'top 5', 'top 10', 'largest', 'biggest', 'most'],
  LOWEST: ['lowest', 'minimum', 'bottom 5', 'bottom 10', 'smallest', 'least', 'worst'],
  BREAKDOWN: ['breakdown', 'by category', 'per category', 'by region', 'per region', 'by month', 'per month', 'each category', 'each region', 'group by category', 'group by region', 'split by'],
  TREND: ['trend', 'over time', 'growth over time', 'increase over time', 'decrease over time', 'change over time', 'history', 'timeline', 'monthly trend', 'yearly trend'],
  COMPARISON: ['compare', 'versus', 'vs', 'difference between', 'which is better', 'higher than', 'lower than', 'more than', 'less than'],
  CORRELATION: ['correlation', 'related to', 'relationship', 'associated with', 'connected to', 'affect', 'impact'],
  DISTRIBUTION: ['distribution', 'spread', 'range', 'percentile', 'quartile', 'frequency', 'histogram'],
  STATISTICS: ['how many', 'count of', 'total', 'number of', 'how much', 'average', 'mean', 'minimum', 'maximum', 'min', 'max', 'sum of', 'statistics', 'summarize', 'what is the average', 'what is the total'],
  ANALYTICAL: [],
};

function classifyQueryIntent(query) {
  const lowerQuery = query.toLowerCase().trim();
  
  // Sort patterns by length (longer = more specific = higher priority)
  const sortedIntents = Object.entries(QUERY_INTENTS).sort((a, b) => {
    const aMaxLen = Math.max(...a[1].map(p => p.length));
    const bMaxLen = Math.max(...b[1].map(p => p.length));
    return bMaxLen - aMaxLen;
  });
  
  for (const [intent, patterns] of sortedIntents) {
    // Sort patterns by length within each intent
    const sortedPatterns = [...patterns].sort((a, b) => b.length - a.length);
    for (const pattern of sortedPatterns) {
      if (lowerQuery.includes(pattern)) {
        return intent;
      }
    }
  }
  
  return 'ANALYTICAL';
}

function detectColumnsFromQuery(query, schema) {
  const lowerQuery = query.toLowerCase();
  const columns = schema.columns || [];
  
  const mentionedDimension = columns.find(col => 
    col.role === 'dimension' && lowerQuery.includes(col.name.toLowerCase())
  );
  
  const mentionedMetric = columns.find(col => 
    col.role === 'metric' && lowerQuery.includes(col.name.toLowerCase())
  );
  
  return {
    dimension: mentionedDimension || schema.primaryDimension || columns.find(c => c.role === 'dimension'),
    metric: mentionedMetric || schema.primaryMetric || columns.find(c => c.role === 'metric'),
  };
}

function handleGreetingQuery(dataset, schema) {
  const columnList = schema.columns?.map(c => c.name).join(', ') || 'various columns';
  const rowCount = dataset.rowCount?.toLocaleString() || 'many';
  
  return {
    content: `Hello! I'm your data analytics assistant. This dataset "${dataset.name}" contains ${rowCount} records with ${columnList}. What would you like to explore?`,
    sql: null,
    chart: null,
    insights: [
      `Dataset: ${dataset.name}`,
      `Records: ${rowCount}`,
      `Columns: ${schema.columnCount || schema.columns?.length || 0}`,
      schema.dataType ? `Data Type: ${schema.dataType}` : null,
    ].filter(Boolean),
  };
}

function handleDatasetInfoQuery(dataset, schema) {
  const columns = schema.columns || [];
  const dimensions = columns.filter(c => c.role === 'dimension').map(c => c.name);
  const metrics = columns.filter(c => c.role === 'metric').map(c => c.name);
  
  let content = `This is a **${dataset.name}** dataset with **${dataset.rowCount?.toLocaleString()}** rows and **${columns.length}** columns.\n\n`;
  
  if (dimensions.length > 0) {
    content += `**Dimensions (Categories):** ${dimensions.join(', ')}\n`;
  }
  if (metrics.length > 0) {
    content += `**Metrics (Numbers):** ${metrics.join(', ')}\n`;
  }
  
  if (schema.dataType) {
    content += `\n**Detected Data Type:** ${schema.dataType}`;
  }
  
  const insights = [
    `Dataset: ${dataset.name}`,
    `Total Rows: ${dataset.rowCount?.toLocaleString()}`,
    `Total Columns: ${columns.length}`,
    dimensions.length > 0 ? `Dimensions: ${dimensions.join(', ')}` : null,
    metrics.length > 0 ? `Metrics: ${metrics.join(', ')}` : null,
    schema.dataType ? `Data Type: ${schema.dataType}` : null,
  ].filter(Boolean);
  
  return {
    content,
    sql: null,
    chart: null,
    insights,
  };
}

function handleStatisticsQuery(dataset, analyticsDataset, schema, query) {
  const { dimension, metric } = detectColumnsFromQuery(query, schema);
  const lowerQuery = query.toLowerCase();
  
  let result = { content: '', chart: null, sql: '' };
  
  if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
    if (dimension) {
      const grouped = countRowsByDimension(analyticsDataset.rows, dimension);
      const total = grouped.reduce((sum, row) => sum + Number(row.count || 0), 0);
      const breakdown = grouped
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, 5)
        .map((row) => `${row[dimension.name]}: ${Number(row.count || 0).toLocaleString()}`)
        .join('\n');
      
      result.content = `Total records: **${total.toLocaleString()}**. Here's the breakdown by ${dimension.name}:\n${breakdown}`;
      result.chart = {
        type: 'bar',
        title: `Count by ${dimension.name}`,
        data: grouped,
      };
      result.sql = `SELECT ${dimension.name}, COUNT(*) as count FROM dataset_rows GROUP BY ${dimension.name}`;
    }
  } else if (metric) {
    const values = analyticsDataset.rows.map(row => Number(row[metric.name])).filter(v => !isNaN(v));
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      result.content = `Statistics for **${metric.name}:**\n- Sum: ${sum.toLocaleString()}\n- Average: ${avg.toLocaleString()}\n- Minimum: ${min.toLocaleString()}\n- Maximum: ${max.toLocaleString()}\n- Total Records: ${values.length.toLocaleString()}`;
      result.sql = `SELECT SUM(${metric.name}), AVG(${metric.name}), MIN(${metric.name}), MAX(${metric.name}) FROM dataset_rows`;
    }
  }
  
  result.insights = [`Analysis based on ${metric?.name || 'available metrics'}`];
  return result;
}

function handleComparisonQuery(dataset, analyticsDataset, schema, query, intent) {
  const { dimension, metric } = detectColumnsFromQuery(query, schema);
  
  if (!dimension || !metric) {
    return {
      content: "I need more specific information about which dimensions and metrics you'd like to compare. Could you clarify?",
      sql: null,
      chart: null,
      insights: ['Please specify the columns to compare'],
    };
  }
  
  const grouped = groupMetricByDimension(analyticsDataset.rows, dimension, metric, 'sum');
  const sorted = [...grouped].sort((a, b) => Number(b[metric.name] || 0) - Number(a[metric.name] || 0));
  
  const isHighest = intent === 'HIGHEST';
  const isLowest = intent === 'LOWEST';
  const topN = isHighest || isLowest ? 5 : sorted.length;
  const slice = isHighest ? sorted.slice(0, topN) : sorted.slice(-topN).reverse();
  
  const total = grouped.reduce((sum, row) => sum + Number(row[metric.name] || 0), 0);
  const topValue = Number(slice[0]?.[metric.name] || 0);
  const topLabel = slice[0]?.[dimension.name] || 'N/A';
  
  let content = '';
  if (isHighest) {
    content = `Top ${topN} ${dimension.name} by **${metric.name}:**\n`;
    content += slice.map((row, i) => {
      const value = Number(row[metric.name] || 0);
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      return `${i + 1}. ${row[dimension.name]}: ${value.toLocaleString()} (${percentage}%)`;
    }).join('\n');
  } else if (isLowest) {
    content = `Lowest ${topN} ${dimension.name} by **${metric.name}:**\n`;
    content += slice.map((row, i) => {
      const value = Number(row[metric.name] || 0);
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      return `${i + 1}. ${row[dimension.name]}: ${value.toLocaleString()} (${percentage}%)`;
    }).join('\n');
  } else {
    content = `**${metric.name}** by ${dimension.name}:\n`;
    content += sorted.slice(0, 10).map((row) => `${row[dimension.name]}: ${Number(row[metric.name] || 0).toLocaleString()}`).join('\n');
  }
  
  return {
    content,
    sql: `SELECT ${dimension.name}, SUM(${metric.name}) as ${metric.name} FROM dataset_rows GROUP BY ${dimension.name} ORDER BY ${metric.name} ${isHighest ? 'DESC' : 'ASC'}`,
    chart: {
      type: 'bar',
      title: `${metric.name} by ${dimension.name}`,
      xKey: dimension.name,
      yKey: metric.name,
      data: slice,
    },
    insights: [
      `Top performer: ${topLabel} with ${topValue.toLocaleString()}`,
      `Total: ${total.toLocaleString()}`,
    ],
  };
}

function handleTrendQuery(dataset, analyticsDataset, schema, query) {
  const { dimension, metric } = detectColumnsFromQuery(query, schema);
  const dateColumns = schema.dateColumns || schema.columns?.filter(c => 
    c.type === 'date' || c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('month') || c.name.toLowerCase().includes('year')
  ) || [];
  
  const timeDim = dimension?.name && dateColumns.find(d => d.toLowerCase() === dimension.name.toLowerCase()) 
    ? dimension 
    : { name: dateColumns[0] || 'month', role: 'dimension' };
  
  if (!timeDim.name || !metric) {
    return {
      content: "I couldn't identify a time dimension and metric for trend analysis. Could you specify which columns to use?",
      sql: null,
      chart: null,
      insights: ['Please specify time column and metric'],
    };
  }
  
  const grouped = groupMetricByDimension(analyticsDataset.rows, { name: timeDim.name, role: 'dimension' }, metric, 'sum');
  const sorted = [...grouped].sort((a, b) => String(a[timeDim.name]).localeCompare(String(b[timeDim.name])));
  
  const firstValue = Number(sorted[0]?.[metric.name] || 0);
  const lastValue = Number(sorted[sorted.length - 1]?.[metric.name] || 0);
  const change = firstValue > 0 ? ((lastValue - firstValue) / firstValue * 100) : 0;
  
  return {
    content: `**${metric.name}** trend over **${timeDim.name}:**\n${sorted.map((row) => `${row[timeDim.name]}: ${Number(row[metric.name] || 0).toLocaleString()}`).join('\n')}\n\nOverall change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
    sql: `SELECT ${timeDim.name}, SUM(${metric.name}) as ${metric.name} FROM dataset_rows GROUP BY ${timeDim.name} ORDER BY ${timeDim.name}`,
    chart: {
      type: 'line',
      title: `${metric.name} Over Time`,
      xKey: timeDim.name,
      yKey: metric.name,
      data: sorted,
    },
    insights: [
      `First period: ${firstValue.toLocaleString()}`,
      `Last period: ${lastValue.toLocaleString()}`,
      `Change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
    ],
  };
}

function handleBreakdownQuery(dataset, analyticsDataset, schema, query) {
  const { dimension, metric } = detectColumnsFromQuery(query, schema);
  
  if (!dimension || !metric) {
    return handleComparisonQuery(dataset, analyticsDataset, schema, query, 'BREAKDOWN');
  }
  
  const grouped = groupMetricByDimension(analyticsDataset.rows, dimension, metric, 'sum');
  const total = grouped.reduce((sum, row) => sum + Number(row[metric.name] || 0), 0);
  const breakdown = grouped
    .sort((a, b) => Number(b[metric.name] || 0) - Number(a[metric.name] || 0))
    .map((row) => {
      const value = Number(row[metric.name] || 0);
      return {
        label: row[dimension.name],
        value,
        percentage: total > 0 ? (value / total * 100).toFixed(1) : '0.0',
      };
    });
  
  return {
    content: `**${metric.name}** breakdown by **${dimension.name}:**\n${breakdown.map(b => `${b.label}: ${b.value.toLocaleString()} (${b.percentage}%)`).join('\n')}`,
    sql: `SELECT ${dimension.name}, SUM(${metric.name}) as ${metric.name} FROM dataset_rows GROUP BY ${dimension.name}`,
    chart: {
      type: 'pie',
      title: `${metric.name} by ${dimension.name}`,
      xKey: dimension.name,
      yKey: 'value',
      data: breakdown.map(b => ({ [dimension.name]: b.label, value: b.value })),
    },
    insights: [
      `Total ${metric.name}: ${total.toLocaleString()}`,
      `Categories: ${breakdown.length}`,
    ],
  };
}

function handleCorrelationQuery(dataset, analyticsDataset, schema, query) {
  const numericColumns = analyticsDataset.columns.filter(c => c.type === 'number' || c.type === 'integer');
  
  if (numericColumns.length < 2) {
    return {
      content: "I need at least two numeric columns to analyze correlations. This dataset doesn't seem to have enough numeric data.",
      sql: null,
      chart: null,
      insights: ['Need multiple numeric columns for correlation'],
    };
  }
  
  const { metric } = detectColumnsFromQuery(query, schema);
  const xMetric = metric || numericColumns[0];
  const yMetric = numericColumns.find(c => c.name !== xMetric.name) || numericColumns[1];
  
  if (!xMetric || !yMetric) {
    return {
      content: "I couldn't identify the metrics to compare. Please specify which columns to analyze.",
      sql: null,
      chart: null,
      insights: ['Please specify the metrics to compare'],
    };
  }
  
  const data = analyticsDataset.rows.slice(0, 100).map(row => ({
    x: Number(row[xMetric.name]) || 0,
    y: Number(row[yMetric.name]) || 0,
  })).filter(p => p.x !== 0 && p.y !== 0);
  
  const n = data.length;
  const sumX = data.reduce((s, p) => s + p.x, 0);
  const sumY = data.reduce((s, p) => s + p.y, 0);
  const sumXY = data.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = data.reduce((s, p) => s + p.y * p.y, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const correlation = denominator === 0 ? 0 : numerator / denominator;
  
  const strength = Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak';
  const direction = correlation > 0 ? 'positive' : 'negative';
  
  return {
    content: `Correlation between **${xMetric.name}** and **${yMetric.name}:**\n- Correlation coefficient: ${correlation.toFixed(3)}\n- Strength: ${strength}\n- Direction: ${direction}\n\nThis ${strength} ${direction} correlation indicates that as one variable ${direction === 'positive' ? 'increases' : 'decreases'}, the other tends to ${direction === 'positive' ? 'increase' : 'decrease'}.`,
    sql: null,
    chart: {
      type: 'scatter',
      title: `${xMetric.name} vs ${yMetric.name}`,
      xKey: xMetric.name,
      yKey: yMetric.name,
      data,
    },
    insights: [
      `Correlation: ${correlation.toFixed(3)}`,
      `Interpretation: ${strength} ${direction} relationship`,
      `Data points: ${n}`,
    ],
  };
}

export function handleSmartQuery(dataset, query) {
  try {
    console.log(`[smart-query] Processing: "${query}"`);
    
    if (!dataset || !dataset.columns || !dataset.rows) {
      console.log('[smart-query] Invalid dataset - using fallback response');
      return {
        content: `This dataset has ${dataset?.rowCount || 0} rows and ${dataset?.columns?.length || 0} columns. I can help you analyze it - try asking about statistics, trends, or comparisons!`,
        sql: null,
        chart: null,
        insights: ['Dataset info'],
      };
    }
    
    console.log('[smart-query] Step 1: prepareDatasetForAnalytics');
    const analyticsDataset = prepareDatasetForAnalytics(dataset);
    console.log('[smart-query] Step 2: analyticsDataset ready');
    
    if (!analyticsDataset) {
      console.log('[smart-query] Failed to prepare analytics dataset - using fallback');
      return {
        content: `I see you have a dataset called "${dataset.name}" with ${dataset.rowCount} rows. What would you like to know about it?`,
        sql: null,
        chart: null,
        insights: ['Fallback response'],
      };
    }
    
    console.log('[smart-query] Step 3: buildDatasetSchema');
    const basicSchema = buildDatasetSchema(analyticsDataset);
    console.log('[smart-query] Step 4: buildEnhancedSchema');
    const enhancedSchema = buildEnhancedSchema(dataset.columns, dataset.rows);
    
    const schema = {
      ...enhancedSchema,
      ...basicSchema,
      columns: enhancedSchema.columns || basicSchema.columns || dataset.columns,
    };
    
    const intent = classifyQueryIntent(query);
    console.log(`[smart-query] Intent: ${intent}`);
    
    let result = null;
    
    if (intent === 'GREETING') {
      result = handleGreetingQuery(dataset, schema);
    } else if (intent === 'DATASET_INFO') {
      result = handleDatasetInfoQuery(dataset, schema);
    } else if (intent === 'STATISTICS') {
      result = handleStatisticsQuery(dataset, analyticsDataset, schema, query);
    } else if (['HIGHEST', 'LOWEST', 'COMPARISON'].includes(intent)) {
      result = handleComparisonQuery(dataset, analyticsDataset, schema, query, intent);
    } else if (intent === 'TREND') {
      result = handleTrendQuery(dataset, analyticsDataset, schema, query);
    } else if (intent === 'BREAKDOWN') {
      result = handleBreakdownQuery(dataset, analyticsDataset, schema, query);
    } else if (intent === 'CORRELATION') {
      result = handleCorrelationQuery(dataset, analyticsDataset, schema, query);
    } else {
      result = handleBreakdownQuery(dataset, analyticsDataset, schema, query);
    }
    
    // If no valid result, create a fallback
    if (!result || !result.content) {
      console.log('[smart-query] No result, creating fallback');
      const primaryMetric = schema.primaryMetric || 'revenue';
      const primaryDim = schema.primaryDimension || 'category';
      result = {
        content: `Based on your query about "${query}", I can see you want to analyze the ${primaryMetric} by ${primaryDim}. Here's what I found in your ${dataset.name} dataset.`,
        sql: `SELECT ${primaryDim}, SUM(${primaryMetric}) as ${primaryMetric} FROM dataset_rows GROUP BY ${primaryDim}`,
        chart: {
          type: 'bar',
          title: `${primaryMetric} by ${primaryDim}`,
          xKey: primaryDim,
          yKey: primaryMetric,
          data: [],
        },
        insights: [`Dataset: ${dataset.name}`, `Rows: ${dataset.rowCount}`, `Query intent: ${intent}`],
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('[smart-query] Error:', error.message, error.stack);
    console.error('[smart-query] Dataset keys:', dataset ? Object.keys(dataset) : 'null');
    console.error('[smart-query] Columns sample:', dataset?.columns?.slice(0, 2));
    console.error('[smart-query] Rows sample:', dataset?.rows?.slice(0, 1));
    return {
      content: `I encountered an issue processing your query. This dataset has ${dataset?.rowCount || 0} rows. How can I help you analyze it?`,
      sql: null,
      chart: null,
      insights: ['Error fallback'],
    };
  }
}

export default handleSmartQuery;
