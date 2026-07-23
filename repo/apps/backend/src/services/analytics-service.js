import {
  toNumber,
  inferType,
  normalizeColumns,
  generateDemoDataset,
  humanize,
  pickPreferredColumn,
  metricAggregationForColumn,
  sortLabels,
  toLabel,
  normalizeText,
  normalizeGenderLabel,
  normalizeBoardLabel,
  normalizeDimensionLabel,
  isMeaningfulValue,
  prepareDatasetForAnalytics,
  getMinimumGroupCount,
  filterGroupedEntries,
  groupMetricByDimension,
  countRowsByDimension,
  buildDatasetSchema,
  calculatePearsonCorrelation,
} from "@insightflow/shared-analytics";
import { aiRouter } from "./ai-providers/ai-router.js";
import { ollamaAIService, isOllamaConfigured, callOllamaAI } from "./ollama-ai-service.js";
import { sanitizeQueryContext, validateSchemaOnlyContext } from '../utils/schema-extractor.js';
import { handleSmartQuery } from './smart-query-handler.js';

import { buildSchemaPacket, formatSchemaForPrompt } from "./schema-packet-builder.js";

// Re-export for backward compatibility
export { normalizeColumns, generateDemoDataset, buildDatasetSchema };

function buildGuidedDatasetResponse(schema, chart) {
  const dataTypeLabel = schema?.dataTypeLabel || "Data";
  const primaryMetric = schema?.primaryMetric?.name || schema?.primaryMetric || "values";
  const primaryDimension = schema?.primaryDimension?.name || schema?.primaryDimension || "category";

  return {
    content: `This is your ${dataTypeLabel} dataset. You can ask me about trends, comparisons, or insights. For example, you could ask "Show me the top 5 ${primaryDimension} by ${primaryMetric}" or "What are the main patterns in this data?"`,
    insights: [
      `Primary metric: ${primaryMetric}`,
      `Primary dimension: ${primaryDimension}`,
      chart ? `Recommended chart: ${chart.chartType || "bar"}` : null,
    ].filter(Boolean),
  };
}

/**
 * Create schema-first chat response using Ollama llama3.2:latest
 * Enforces privacy by only sending schema metadata to AI
 */
export const createSchemaFirstChatResponse = async (dataset, query, preferences = {}) => {
  const chartCount = preferences.chartCount || "auto";
  const chartTypes = preferences.chartTypes || ["bar", "line", "pie"];
  const showTrends = preferences.showTrends !== false;
  const showCorrelations = preferences.showCorrelations !== false;

  const configured = await isOllamaConfigured();
  
  if (!configured) {
    console.log("[schema-first] Ollama not available, using local analytics");
    return createChatResponse(dataset, query);
  }

  try {
    console.log("[schema-first] Calling Ollama with schema-only approach");
    const result = await callOllamaAI(dataset, query, preferences);
    
    if (!result.success) {
      console.log("[schema-first] Ollama failed, falling back to local");
      return createChatResponse(dataset, query);
    }

    return {
      content: result.insights || result.content || "Analysis complete",
      sql: result.sql,
      chart: result.charts || result.chart_type,
      insights: result.insights,
      schema: result.charts,
      intent: result.intent,
      confidence: result.confidence || 0.8,
      reason: result.reasoning,
      model: result.model || "llama3.2:latest",
      usedAI: true,
      metadata: {
        columnsUsed: result.columns_used,
        chartTypes: result.charts?.map(c => c.type),
        preferences: { chartCount, chartTypes, showTrends, showCorrelations },
      },
    };
  } catch (error) {
    console.log("[schema-first] Error:", error.message);
    return createChatResponse(dataset, query);
  }
};

/**
 * Validate and fix AI-generated SQL to use correct values from dataset
 */
export function validateAndFixSQL(dataset, sql) {
  if (!sql || !dataset?.rows?.length) {
    return sql;
  }

  try {
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*['"]([^'"]+)['"]/gi);
    if (!whereMatch) {
      return sql;
    }

    const columnName = sql.match(/WHERE\s+(\w+)\s*=/i)?.[1];
    if (!columnName) {
      return sql;
    }

    const actualValues = new Set();
    for (const row of dataset.rows) {
      const val = row[columnName];
      if (val !== null && val !== undefined && String(val).trim()) {
        actualValues.add(String(val).trim().toLowerCase());
      }
    }

    if (actualValues.size === 0) {
      return sql;
    }

    let fixedSQL = sql;
    for (const match of whereMatch) {
      const valueMatch = match.match(/WHERE\s+(\w+)\s*=\s*['"]([^'"]+)['"]/i);
      if (!valueMatch) continue;

      const [, col, value] = valueMatch;
      const normalizedValue = value.trim().toLowerCase();

      if (!actualValues.has(normalizedValue)) {
        const matchingValue = [...actualValues].find((v) => {
          if (normalizedValue === "some college" && v === "high school") return true;
          if (normalizedValue === "high school" && v === "some college") return true;
          if (normalizedValue === "master" && v === "masters") return true;
          if (normalizedValue === "masters" && v === "master") return true;
          return v.includes(normalizedValue) || normalizedValue.includes(v);
        });

        if (matchingValue) {
          console.log(`[analytics] 🔧 Fixing SQL value: '${value}' -> '${matchingValue}'`);
          fixedSQL = fixedSQL.replace(/WHERE\s+\w+\s*=\s*['"][^'"]+['"]/i, `WHERE ${col} = '${matchingValue}'`);
        }
      }
    }

    return fixedSQL;
  } catch (error) {
    console.warn("[analytics] SQL validation error:", error.message);
    return sql;
  }
}

export const isGreetingQuery = (query) => {
  const normalizedQuery = normalizeText(query);

  return /^(hello|hi|hey|hola|good morning|good afternoon|good evening)( there)?$/.test(normalizedQuery);
};

const isDatasetHelpQuery = (normalizedQuery) =>
  /\b(help|ask|question|questions|query|queries|prompt|prompts|analyse|analyze)\b/.test(normalizedQuery)
  && /\b(dataset|data|table|file|column|columns)\b/.test(normalizedQuery);

const singularizeWord = (word) => {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
};

const normalizeComparableText = (value) =>
  normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map(singularizeWord)
    .join(" ");

const includesPhrase = (source, phrase) => {
  if (!source || !phrase) return false;
  return (` ${source} `).includes(` ${phrase} `);
};

export const isDatasetOverviewQuery = (normalizedQuery) =>
  /\b(what|waht|which|describe|explain|summary|summarize|overview|about)\b/.test(normalizedQuery)
  && /\b(dataset|data|table|file)\b/.test(normalizedQuery);

export const classifyChatQuery = (query) => {
  const normalizedQuery = normalizeText(query);

  if (isGreetingQuery(query)) {
    return "greeting";
  }

  if (isDatasetOverviewQuery(normalizedQuery) || isDatasetHelpQuery(normalizedQuery)) {
    return "dataset-help";
  }

  return "analysis";
};

const pickDimensionForQuery = (schema, queryLower) => {
  const dimensions = schema.columns.filter((column) => column.role === "dimension");
  return dimensions.find((column) => queryLower.includes(column.name.toLowerCase()))
    ?? schema.primaryDimension
    ?? schema.secondaryDimension
    ?? null;
};

const pickMetricForQuery = (schema, queryLower) => {
  const metrics = schema.columns.filter((column) => column.role === "metric");
  return metrics.find((column) => queryLower.includes(column.name.toLowerCase()))
    ?? schema.primaryMetric
    ?? schema.secondaryMetric
    ?? null;
};

const detectQueryValueFilter = (dataset, schema, normalizedQuery) => {
  const dimensions = schema.columns.filter((column) => column.role === "dimension");
  const comparableQuery = normalizeComparableText(normalizedQuery);

  for (const dimension of dimensions) {
    const values = new Set();

    // Only analyze schema structure, not actual data values
    // This prevents data leakage to AI services
    if (dataset && dataset.rows) {
      for (const row of dataset.rows) {
        const label = normalizeDimensionLabel(dimension.name, row[dimension.name]);
        if (label) {
          values.add(label);
        }
        if (values.size >= 50) {
          break;
        }
      }
    }

    const matches = [];

    for (const value of values) {
      const normalizedValue = normalizeText(value);
      const comparableValue = normalizeComparableText(value);
      if (!normalizedValue) {
        continue;
      }

      if (includesPhrase(normalizedQuery, normalizedValue) || includesPhrase(comparableQuery, comparableValue)) {
        matches.push(value);
      }
    }

    if (matches.length > 0) {
      return { dimension, values: [...new Set(matches)] };
    }
  }

  return null;
};

const buildAnalysisPlan = (dataset, schema, query) => {
  const queryLower = query.toLowerCase();
  const normalizedQuery = normalizeText(query);
  const dimension = pickDimensionForQuery(schema, queryLower);
  const metric = pickMetricForQuery(schema, queryLower);
  const valueFilter = detectQueryValueFilter(dataset, schema, normalizedQuery);
  const wantsCount = /\bhow many\b|\bcount\b|\bnumber of\b|\btotal people\b|\bpeople\b/.test(normalizedQuery);
  const mentionsMetric = schema.columns
    .filter((column) => column.role === "metric")
    .some((column) => includesPhrase(normalizedQuery, normalizeText(column.name)));
  const overviewQuery = isDatasetOverviewQuery(normalizedQuery);

  if (overviewQuery) {
    return {
      mode: "overview",
      metric,
      dimension: schema.primaryDimension ?? dimension,
      chartType: "bar",
      intent: "overview",
    };
  }

  if ((queryLower.includes("trend") || queryLower.includes("monthly") || queryLower.includes("over time")) && schema.primaryDimension) {
    const trendDimension = schema.columns.find((column) => column.name === schema.primaryDimension.name && (column.type === "date" || column.name === "month"))
      ?? schema.columns.find((column) => column.type === "date")
      ?? schema.columns.find((column) => column.name === "month")
      ?? schema.primaryDimension;

    return {
      mode: "metricByDimension",
      metric,
      dimension: trendDimension,
      aggregation: metric ? metricAggregationForColumn(metric.name) : "sum",
      chartType: trendDimension.type === "date" || trendDimension.name === "month" ? "area" : "line",
      intent: "trend",
    };
  }

  if (wantsCount && valueFilter) {
    return {
      mode: "countMatchingValues",
      dimension: valueFilter.dimension,
      matchValues: valueFilter.values,
      chartType: "bar",
      intent: "count-filter",
    };
  }

  if (valueFilter && !mentionsMetric) {
    return {
      mode: "countMatchingValues",
      dimension: valueFilter.dimension,
      matchValues: valueFilter.values,
      chartType: "bar",
      intent: "value-filter",
    };
  }

  if (wantsCount && dimension) {
    return {
      mode: "countByDimension",
      dimension,
      chartType: "pie",
      intent: "count",
    };
  }

  if (dimension && metric) {
    return {
      mode: "metricByDimension",
      metric,
      dimension,
      aggregation: queryLower.includes("average") || queryLower.includes("avg")
        ? "average"
        : metricAggregationForColumn(metric.name),
      chartType: queryLower.includes("pie") ? "pie" : "bar",
      intent: "breakdown",
    };
  }

  if (dimension) {
    return {
      mode: "countByDimension",
      dimension,
      chartType: "pie",
      intent: "count",
    };
  }

  return {
    mode: "summary",
    metric,
    dimension,
    chartType: "bar",
    intent: "summary",
  };
};

const materializePlan = (dataset, plan) => {
  if (plan.mode === "overview" && plan.dimension) {
    const data = countRowsByDimension(dataset.rows, plan.dimension).slice(0, 8);
    if (data.length === 0) {
      return null;
    }

    return {
      type: data.length <= 6 ? "pie" : "bar",
      title: `Dataset overview by ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: "count",
      data,
    };
  }

  if (plan.mode === "metricByDimension" && plan.metric && plan.dimension) {
    const data = groupMetricByDimension(dataset.rows, plan.dimension, plan.metric, plan.aggregation);
    return {
      type: plan.chartType === "pie" && data.length <= 6 ? "pie" : plan.chartType,
      title: `${plan.aggregation === "average" ? "Average " : ""}${humanize(plan.metric.name)} by ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: plan.metric.name,
      data,
    };
  }

  if (plan.mode === "countByDimension" && plan.dimension) {
    const data = countRowsByDimension(dataset.rows, plan.dimension);
    return {
      type: data.length <= 6 ? "pie" : "bar",
      title: `Count by ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: "count",
      data,
    };
  }

  if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const data = countRowsMatchingValues(dataset.rows, plan.dimension, plan.matchValues);
    const titleValues = plan.matchValues.join(", ");
    return {
      type: "bar",
      title: `Count of ${titleValues} in ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: "count",
      data,
    };
  }

  return null;
};

const buildSqlForPlan = (plan) => {
  if (plan.mode === "overview") {
    return null;
  }

  if (plan.mode === "metricByDimension" && plan.metric && plan.dimension) {
    const aggregationSql = plan.aggregation === "average" ? "AVG" : "SUM";
    return `SELECT ${plan.dimension.name}, ${aggregationSql}(${plan.metric.name}) AS ${plan.metric.name} FROM dataset_rows GROUP BY ${plan.dimension.name} ORDER BY ${plan.metric.name} DESC;`;
  }

  if (plan.mode === "countByDimension" && plan.dimension) {
    return `SELECT ${plan.dimension.name}, COUNT(*) AS count FROM dataset_rows GROUP BY ${plan.dimension.name} ORDER BY count DESC;`;
  }

  if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const escapedValues = plan.matchValues.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(", ");
    return `SELECT ${plan.dimension.name}, COUNT(*) AS count FROM dataset_rows WHERE ${plan.dimension.name} IN (${escapedValues}) GROUP BY ${plan.dimension.name} ORDER BY count DESC;`;
  }

  return "SELECT * FROM dataset_rows LIMIT 100;";
};

const buildInsightsFromSchema = (schema, plan) => {
  const base = [
    `Schema inspection found ${schema.columnCount} columns across ${schema.rowCount} rows.`,
    `Dimensions: ${schema.columns.filter((column) => column.role === "dimension").map((column) => column.name).join(", ") || "none"}.`,
    `Metrics: ${schema.columns.filter((column) => column.role === "metric").map((column) => column.name).join(", ") || "none"}.`,
  ];

  if (plan.mode === "metricByDimension" && plan.metric && plan.dimension) {
    base.push(`This response used the schema to pair metric \`${plan.metric.name}\` with dimension \`${plan.dimension.name}\`.`);
  } else if (plan.mode === "overview") {
    const primaryDimension = plan.dimension?.name ? `\`${plan.dimension.name}\`` : "the primary categorical columns";
    base.push(`This response summarizes the dataset structure and highlights ${primaryDimension} as the main grouping field.`);
  } else if (plan.mode === "countByDimension" && plan.dimension) {
    base.push(`This response used the schema to count records by \`${plan.dimension.name}\` without sending row values to any AI system.`);
  } else if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const valuesList = plan.matchValues.map((value) => `\`${value}\``).join(", ");
    base.push(`This response counted rows where \`${plan.dimension.name}\` matched ${valuesList} using only local processing.`);
  }

  return base;
};

export const createChatResponse = async (dataset, query) => {
  const analyticsDataset = prepareDatasetForAnalytics(dataset);
  const schema = buildDatasetSchema(analyticsDataset);
  const queryType = classifyChatQuery(query);

  if (queryType === "greeting") {
    const chart = materializePlan(analyticsDataset, {
      mode: "overview",
      metric: schema.primaryMetric,
      dimension: schema.primaryDimension ?? schema.secondaryDimension,
      chartType: "bar",
      intent: "overview",
    });
    const guided = buildGuidedDatasetResponse(schema, chart);

    return {
      content: "Hello! I'm here to help you analyze your data. What would you like to explore?",
      sql: null,
      chart,
      insights: guided.insights,
      schema,
      intent: "greeting",
    };
  }

  if (queryType === "dataset-help") {
    const chart = materializePlan(analyticsDataset, {
      mode: "overview",
      metric: schema.primaryMetric,
      dimension: schema.primaryDimension ?? schema.secondaryDimension,
      chartType: "bar",
      intent: "overview",
    });
    const guided = buildGuidedDatasetResponse(schema, chart);

    return {
      content: guided.content,
      sql: null,
      chart,
      insights: guided.insights,
      schema,
      intent: "overview",
    };
  }

  // First try HR-specific query handler
  const hrPlan = handleHRDatasetQuery(dataset, query);
  if (hrPlan) {
    console.log('[analytics] Using HR dataset query handler');
    const chart = materializePlan(analyticsDataset, hrPlan);
    
    let content = '';
    if (hrPlan.intent === 'aggregation') {
      content = `Aggregating ${hrPlan.metric?.name} by ${hrPlan.dimension?.name} using ${hrPlan.aggregation}`;
    } else if (hrPlan.intent === 'correlation') {
      content = `Showing correlation between ${hrPlan.dimension?.name} and ${hrPlan.metric?.name}`;
    } else if (hrPlan.intent === 'ranking') {
      content = `Top rankings by ${hrPlan.metric?.name}`;
    } else if (hrPlan.intent === 'distribution') {
      content = `Distribution of ${hrPlan.metric?.name} by ${hrPlan.dimension?.name}`;
    } else if (hrPlan.intent === 'count') {
      content = `Count by ${hrPlan.dimension?.name}`;
    } else if (hrPlan.intent === 'comparison') {
      content = `Comparing ${hrPlan.metric?.name} across ${hrPlan.dimension?.name}`;
    }
    
    return {
      content,
      chart,
      insights: [
        `Analysis type: ${hrPlan.intent}`,
        `Chart type: ${hrPlan.chartType}`,
        `Aggregation: ${hrPlan.aggregation || 'count'}`,
      ],
      schema: buildDatasetSchema(analyticsDataset),
      aiProvider: 'hr-handler',
      intent: hrPlan.intent,
    };
  }

  // Use smart query handler for better responses
  try {
    console.log('[analytics] Calling smart query handler for:', query);
    const smartResponse = handleSmartQuery(dataset, query);
    console.log('[analytics] Smart response:', JSON.stringify(smartResponse)?.substring(0, 100) || 'null/undefined');
    if (smartResponse && typeof smartResponse === 'object' && 'content' in smartResponse && smartResponse.content) {
      console.log('[analytics] Using smart query handler result');
      return {
        ...smartResponse,
        schema: buildDatasetSchema(analyticsDataset),
        aiProvider: 'smart-handler',
      };
    } else {
      console.log('[analytics] Smart response empty, falling through');
    }
  } catch (error) {
    console.warn('[analytics] Smart query handler error:', error.message);
  }

  // Try to get AI-enhanced response first with Ollama + Mistral
  try {
    // Check if Ollama is available
    const ollamaAvailable = await isOllamaConfigured();
    
    if (ollamaAvailable) {
      console.log('[analytics] Using Ollama + Mistral for AI analysis');
      
      // Prepare dataset for AI (schema-only)
      const datasetForAI = {
        name: dataset.name,
        rowCount: dataset.rowCount,
        columns: dataset.columns,
      };
      
      const aiResponse = await callOllamaAI(datasetForAI, query);
      
      if (aiResponse.success && aiResponse.usedAI) {
        console.log('[analytics] Ollama analysis successful');
        
        // Generate chart if AI suggested one
        let chart = null;
        if (aiResponse.chart_type && aiResponse.chart_type !== "table") {
          const plan = buildPlanFromAIResponse(analyticsDataset, aiResponse);
          chart = materializePlan(analyticsDataset, plan);
        }
        
        return {
          content: aiResponse.insight,
          sql: aiResponse.sql,
          chart,
          insights: [
            `Analysis type: ${aiResponse.intent}`,
            `Confidence: ${(aiResponse.confidence * 100).toFixed(0)}%`,
            aiResponse.reasoning,
            `Using local Mistral model (schema-only analysis)`,
          ],
          schema,
          aiProvider: 'ollama',
          aiModel: aiResponse.model || 'mistral',
          usedAI: true,
          confidence: aiResponse.confidence,
          intent: aiResponse.intent,
        };
      }
    } else {
      console.log('[analytics] Ollama not available, trying AI router fallback');
      
      // Fallback to existing AI router
      const aiContext = {
        dataset: {
          name: dataset.name,
          rowCount: dataset.rowCount,
        },
        schema,
        query,
      };
      
      const sanitizedContext = sanitizeQueryContext(aiContext);
      const validation = validateSchemaOnlyContext(sanitizedContext);
      
      if (!validation.isValid) {
        console.warn('Analytics service detected potential data leakage:', validation.violations);
      }
      
      const aiResult = await aiRouter.generateResponse(query, sanitizedContext);
      
      if (aiResult.success) {
        const plan = buildAnalysisPlan(analyticsDataset, schema, query);
        const chart = materializePlan(analyticsDataset, plan);
        
        return {
          content: aiResult.content,
          sql: buildSqlForPlan(plan),
          chart,
          insights: buildInsightsFromSchema(schema, plan),
          schema,
          aiProvider: aiResult.provider,
          aiModel: aiResult.model,
          fallbackUsed: aiResult.fallbackUsed,
        };
      }
    }
  } catch (error) {
    console.warn('AI response failed, falling back to traditional analysis:', error.message);
  }

  // Fallback to traditional analysis
  const plan = buildAnalysisPlan(analyticsDataset, schema, query);
  const chart = materializePlan(analyticsDataset, plan);

  let content = `I analyzed the ${schema.datasetName} schema and used it to select an appropriate ${chart?.type ?? "summary"} view.`;

  if (plan.mode === "overview") {
    content = buildOverviewContent(schema, chart);
  } else if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && chart?.data?.length) {
    const total = chart.data.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const breakdown = chart.data.map((item) => `${item[plan.dimension.name]}: ${Number(item.count ?? 0).toLocaleString()}`).join("; ");
    const valueList = plan.matchValues.map((value) => `"${value}"`).join(" and ");
    const percentage = ((total / schema.rowCount) * 100).toFixed(1);
    content = `Found ${total.toLocaleString()} records (${percentage}%) matching ${humanize(plan.dimension.name)} = ${valueList} out of ${schema.rowCount.toLocaleString()} total records. Breakdown: ${breakdown}.`;
  } else if (plan.mode === "countByDimension" && plan.dimension && chart?.data?.length) {
    const total = chart.data.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const topItems = chart.data.slice(0, 5).map((item) => `${item[plan.dimension.name]}: ${Number(item.count ?? 0).toLocaleString()}`).join(", ");
    content = `Counted ${total.toLocaleString()} records by ${humanize(plan.dimension.name)}. Top categories: ${topItems}.`;
  } else if (plan.mode === "metricByDimension" && plan.metric && plan.dimension && chart?.data?.length) {
    const total = chart.data.reduce((sum, item) => sum + Number(item[plan.metric.name] ?? 0), 0);
    const avg = chart.data.length > 0 ? (total / chart.data.length).toFixed(2) : 0;
    content = `Aggregated ${humanize(plan.metric.name)} by ${humanize(plan.dimension.name)} using ${plan.aggregation}. Total: ${Number(total).toLocaleString()}, Average: ${avg}.`;
  }

  return {
    content,
    sql: buildSqlForPlan(plan),
    chart,
    insights: buildInsightsFromSchema(schema, plan),
    schema,
    aiProvider: 'traditional',
  };
};

/**
 * Build enhanced schema for HR/salary datasets
 */
const buildHRDatasetSchema = (dataset) => {
  const columns = (dataset.columns || []).map(col => {
    const name = col.name || '';
    const type = col.type || 'string';
    
    let role = 'dimension';
    
    if (type === 'number' || type === 'integer') {
      const lowerName = name.toLowerCase();
      if (lowerName.includes('salary') || 
          lowerName.includes('experience') ||
          lowerName.includes('revenue') ||
          lowerName.includes('amount') ||
          lowerName.includes('count') ||
          lowerName.includes('bonus') ||
          lowerName.includes('pay') ||
          lowerName.includes('cost') ||
          lowerName.includes('age')) {
        role = 'metric';
      } else if (lowerName.includes('id') || 
                 lowerName.includes('row') || 
                 lowerName.includes('index') ||
                 lowerName.includes('_id')) {
        role = 'excluded';
      }
    }
    
    return {
      name: col.name,
      type: type,
      role: role,
    };
  });

  return {
    columns,
    primaryMetric: columns.find(col => col.role === 'metric'),
    primaryDimension: columns.find(col => col.role === 'dimension'),
    secondaryMetric: columns.filter(col => col.role === 'metric')[1],
    secondaryDimension: columns.filter(col => col.role === 'dimension')[1],
  };
};

/**
 * Handle smart queries for HR data
 */
const handleHRDatasetQuery = (dataset, query) => {
  const schema = buildHRDatasetSchema(dataset);
  const q = query.toLowerCase();
  const metrics = schema.columns.filter(c => c.role === 'metric');
  const dimensions = schema.columns.filter(c => c.role === 'dimension');
  
  const primaryMetric = schema.primaryMetric || metrics[0];
  const primaryDim = schema.primaryDimension || dimensions[0];
  const secondaryDim = schema.secondaryDimension || dimensions[1];
  
  // Salary by category
  if (q.includes('salary') && primaryMetric && primaryDim) {
    const targetDim = dimensions.find(d => q.includes(d.name.toLowerCase())) || primaryDim;
    return {
      mode: 'metricByDimension',
      metric: primaryMetric,
      dimension: targetDim,
      aggregation: q.includes('average') || q.includes('avg') ? 'average' : 'sum',
      chartType: q.includes('pie') ? 'pie' : 'bar',
      intent: 'aggregation',
    };
  }
  
  // Experience vs salary
  if (q.includes('experience') && (q.includes('salary') || q.includes('vs'))) {
    const expCol = schema.columns.find(c => c.name.toLowerCase().includes('experience'));
    if (expCol && primaryMetric) {
      return {
        mode: 'metricByDimension',
        metric: primaryMetric,
        dimension: expCol,
        aggregation: 'average',
        chartType: 'scatter',
        intent: 'correlation',
      };
    }
  }
  
  // Top/bottom
  if (q.includes('top') || q.includes('highest') || q.includes('bottom') || q.includes('lowest')) {
    if (primaryMetric && primaryDim) {
      return {
        mode: 'metricByDimension',
        metric: primaryMetric,
        dimension: primaryDim,
        aggregation: 'sum',
        chartType: 'bar',
        intent: 'ranking',
      };
    }
  }
  
  // Distribution
  if (q.includes('distribution') || q.includes('breakdown') || q.includes('proportion')) {
    if (primaryMetric && secondaryDim) {
      return {
        mode: 'metricByDimension',
        metric: primaryMetric,
        dimension: secondaryDim,
        aggregation: 'sum',
        chartType: 'pie',
        intent: 'distribution',
      };
    }
  }
  
  // Count by category
  if (q.includes('count') || q.includes('how many')) {
    if (primaryDim) {
      return {
        mode: 'countByDimension',
        dimension: primaryDim,
        chartType: 'bar',
        intent: 'count',
      };
    }
  }
  
  // Compare
  if (q.includes('compare') || q.includes('vs') || q.includes('versus')) {
    if (primaryMetric && primaryDim) {
      return {
        mode: 'metricByDimension',
        metric: primaryMetric,
        dimension: primaryDim,
        aggregation: 'average',
        chartType: 'bar',
        intent: 'comparison',
      };
    }
  }
  
  return null;
};

/**
 * Build analysis plan from AI response
 */
const buildPlanFromAIResponse = (analyticsDataset, aiResponse) => {
  const { intent, columns_used, chart_type } = aiResponse;
  
  const dimensions = analyticsDataset.columns.filter(col => col.role === 'dimension');
  const metrics = analyticsDataset.columns.filter(col => col.role === 'metric');
  
  let dimension = dimensions.find(col => columns_used.includes(col.name)) || dimensions[0];
  let metric = metrics.find(col => columns_used.includes(col.name)) || metrics[0];
  
  let mode = 'summary';
  let aggregation = 'sum';
  
  switch (intent) {
    case 'aggregation':
    case 'comparison':
      mode = 'metricByDimension';
      aggregation = 'average';
      break;
    case 'count':
      mode = 'countByDimension';
      break;
    case 'trend':
      mode = 'metricByDimension';
      break;
    case 'distribution':
      mode = 'countByDimension';
      break;
    default:
      mode = 'summary';
  }
  
  return {
    mode,
    metric,
    dimension,
    aggregation,
    chartType: chart_type || 'bar',
    intent,
  };
};

export const generateCorrelationAnalysis = (dataset) => {
  const analyticsDataset = prepareDatasetForAnalytics(dataset);
  const numericColumns = analyticsDataset.columns.filter((column) => column.type === "number");

  if (numericColumns.length < 2) {
    return {
      correlations: [],
      summary: "Not enough numeric columns for correlation analysis.",
      hasGemini: false,
    };
  }

  const columnPairs = [];
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      columnPairs.push([numericColumns[i], numericColumns[j]]);
    }
  }

  const correlations = [];
  for (const [col1, col2] of columnPairs) {
    const x = [];
    const y = [];

    analyticsDataset.rows.forEach((row) => {
      const xVal = toNumber(row[col1.name]);
      const yVal = toNumber(row[col2.name]);
      if (xVal !== null && yVal !== null) {
        x.push(xVal);
        y.push(yVal);
      }
    });

    if (x.length >= 3) {
      const correlation = calculatePearsonCorrelation(x, y);
      if (correlation !== null) {
        let strength = "weak";
        let interpretation = "";

        const absCorr = Math.abs(correlation);
        if (absCorr >= 0.7) {
          strength = "strong";
          interpretation = correlation > 0
            ? `${col1.name} and ${col2.name} show a strong positive correlation.`
            : `${col1.name} and ${col2.name} show a strong negative correlation.`;
        } else if (absCorr >= 0.4) {
          strength = "moderate";
          interpretation = correlation > 0
            ? `${col1.name} and ${col2.name} show moderate positive correlation.`
            : `${col1.name} and ${col2.name} show moderate negative correlation.`;
        } else {
          interpretation = `${col1.name} and ${col2.name} show weak/no significant correlation.`;
        }

        correlations.push({
          column1: col1.name,
          column2: col2.name,
          coefficient: Number(correlation.toFixed(3)),
          strength,
          interpretation,
          sampleSize: x.length,
        });
      }
    }
  }

  correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

  return {
    correlations,
    summary: correlations.length > 0
      ? `Found ${correlations.length} correlation(s) among ${numericColumns.length} numeric columns.`
      : "No significant correlations found between numeric columns.",
    hasGemini: false,
  };
};
