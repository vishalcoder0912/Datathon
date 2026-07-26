/**
 * Ollama AI Service - Using llama3.2:latest
 * Privacy-first: Only schema metadata sent to AI
 */

import { extractSchemaForAI, buildSchemaOnlyPrompt, validateSchemaOnlyContext } from '../utils/schema-extractor.js';
import { serviceUrls } from "../config/serviceUrls.js";
import { getModelForTask } from "../config/model-router.js";

const OLLAMA_BASE_URL = serviceUrls.ollama;
const OLLAMA_MODEL = getModelForTask("main_analyst");
const API_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS) || 60000;

/**
 * Check if Ollama is configured and running
 */
export async function isOllamaConfigured() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    console.log(`[ollama] Ollama is running with models:`, data.models?.map(m => m.name));
    return true;
  } catch (error) {
    console.warn(`[ollama] Ollama not available:`, error.message);
    return false;
  }
}

/**
 * Enhanced system prompt for better AI responses on HR/ salary datasets
 */
const SYSTEM_PROMPT = `You are an expert data analytics AI assistant specializing in HR and salary data analysis.

When analyzing datasets, follow these rules STRICTLY:

1. IDENTIFY COLUMN TYPES:
   - Metrics (numeric columns for aggregation): salary_usd, experience, revenue, count, amount, etc.
   - Dimensions (categorical columns for grouping): country, education, company_size, job_title, gender, department, etc.
   - NEVER use row_id, index, or id columns as metrics or dimensions

2. CHART TYPE SELECTION:
   - For comparing categories: use "bar" chart
   - For trends over time: use "line" or "area" chart
   - For showing proportions: use "pie" chart
   - For correlation between numeric values: use "scatter" chart

3. RESPONSE FORMAT (ALWAYS valid JSON):
{
  "intent": "aggregation|filter|comparison|distribution|correlation|count|trend|breakdown",
  "columns_used": ["metric_column", "dimension_column"],
  "sql": "SELECT dimension_column, AGG(metric_column) FROM dataset_rows GROUP BY dimension_column",
  "insight": "2-3 sentence explanation of what this query will show",
  "chart_type": "bar|line|pie|scatter|area|histogram",
  "confidence": 0.0-1.0,
  "reasoning": "Why this chart/approach is appropriate for this data"
}

4. COMMON PATTERNS FOR HR DATA:
   - Salary by country → bar chart, group by country, aggregate salary_usd with AVG or SUM
   - Experience vs Salary → scatter chart, show correlation
   - Education distribution → pie or bar chart, count by education
   - Company size breakdown → pie chart, count by company_size
   - Top salaries → bar chart, order by salary_usd DESC

5. VALIDATION RULES:
   - Only suggest columns that exist in the schema
   - Always verify the column name matches exactly (case-sensitive)
   - For numeric columns like "salary_usd", use AGG functions (SUM, AVG, MIN, MAX)
   - For string columns like "country", use GROUP BY

CRITICAL: Response must be valid JSON only. No markdown, no explanation outside JSON.`;

/**
 * Call Ollama AI with schema-only approach for better accuracy
 */
export async function callOllamaAI(dataset, query, preferences = {}) {
  const configured = await isOllamaConfigured();
  if (!configured) {
    throw new Error("Ollama service not available. Please start Ollama with: ollama serve");
  }

  try {
    console.log(`[ollama] Analyzing query with ${OLLAMA_MODEL}:`, query);

    // Build enhanced schema with better column classification
    const schemaEnhanced = buildEnhancedSchema(dataset);
    const schemaInfo = extractSchemaForAI(dataset, schemaEnhanced);
    
    // Format the schema prompt
    const schemaPrompt = formatDatasetSchema(schemaEnhanced);

    const userPrompt = `
Analyze this HR/salary dataset and respond with JSON:

DATASET INFO:
- Name: ${dataset.name}
- Rows: ${dataset.rowCount || dataset.rows?.length || 0}

${schemaPrompt}

USER QUERY: "${query}"

Required columns in response:
- intent: What the user wants (aggregation, comparison, distribution, count, trend, breakdown)
- columns_used: Array of column names from the schema above
- sql: Valid SQL query using the column names exactly as shown
- insight: Brief explanation of what the result shows
- chart_type: bar, line, pie, scatter, or area
- confidence: Your confidence score (0-1)
- reasoning: Why you chose this approach

Return ONLY valid JSON, no other text.`;

    // Call Ollama API
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
        stream: false,
        temperature: 0.1,
        num_predict: 600,
        repeat_penalty: 1.1,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.response?.trim() || '';

    // Extract and parse JSON
    let aiResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn("[ollama] JSON parse failed, using fallback:", parseError.message);
      // Fallback to local processing
      return {
        success: true,
        intent: "analysis",
        columns_used: [],
        sql: null,
        insight: responseText.substring(0, 200) || "Analysis complete",
        chart_type: "bar",
        confidence: 0.5,
        reasoning: "Used fallback due to JSON parse error",
        usedAI: true,
        model: OLLAMA_MODEL,
      };
    }

    // Validate and normalize response
    const validated = validateAndNormalizeResponse(aiResponse, schemaEnhanced);

    return {
      success: true,
      ...validated,
      usedAI: true,
      model: OLLAMA_MODEL,
    };
  } catch (error) {
    console.error("[ollama] Error calling Ollama:", error.message);
    return {
      success: false,
      error: error.message,
      usedAI: false,
      shouldFallback: true,
    };
  }
}

/**
 * Build enhanced schema with better column classification
 */
function buildEnhancedSchema(dataset) {
  const columns = (dataset.columns || []).map(col => {
    const name = col.name || '';
    const type = col.type || 'string';
    
    // Classify column role based on name patterns
    let role = 'dimension';
    const lowerName = name.toLowerCase();
    
    // Check if it's a metric (numeric column that's meaningful for aggregation)
    if (type === 'number' || type === 'integer') {
      if (lowerName.includes('salary') || 
          lowerName.includes('experience') ||
          lowerName.includes('revenue') ||
          lowerName.includes('amount') ||
          lowerName.includes('count') ||
          lowerName.includes('bonus') ||
          lowerName.includes('pay')) {
        role = 'metric';
      } else if (lowerName.includes('id') || lowerName.includes('row') || lowerName.includes('index')) {
        role = 'excluded'; // Don't use for charts
      }
    }
    
    return {
      name: col.name,
      type: type,
      role: role,
      sample: col.sample || [],
    };
  });

  return {
    datasetName: dataset.name,
    rowCount: dataset.rowCount || dataset.rows?.length || 0,
    columnCount: columns.length,
    columns: columns,
    primaryDimension: columns.find(col => col.role === 'dimension'),
    primaryMetric: columns.find(col => col.role === 'metric'),
  };
}

/**
 * Format dataset schema for prompt
 */
function formatDatasetSchema(schema) {
  const lines = ['COLUMN SCHEMA:'];
  
  // Group by type
  const metrics = schema.columns.filter(c => c.role === 'metric');
  const dimensions = schema.columns.filter(c => c.role === 'dimension');
  const excluded = schema.columns.filter(c => c.role === 'excluded');
  
  if (metrics.length > 0) {
    lines.push('\nMETRIC COLUMNS (for aggregation - SUM, AVG, COUNT):');
    metrics.forEach(col => {
      lines.push(`  - ${col.name} (${col.type})`);
    });
  }
  
  if (dimensions.length > 0) {
    lines.push('\nDIMENSION COLUMNS (for grouping - GROUP BY):');
    dimensions.forEach(col => {
      lines.push(`  - ${col.name} (${col.type})`);
    });
  }
  
  if (excluded.length > 0) {
    lines.push('\nEXCLUDED (do not use in charts):');
    excluded.forEach(col => {
      lines.push(`  - ${col.name}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Validate and normalize AI response
 */
function validateAndNormalizeResponse(response, schema) {
  const validIntents = ['aggregation', 'filter', 'comparison', 'distribution', 'correlation', 'count', 'trend', 'breakdown', 'analysis'];
  const validChartTypes = ['bar', 'line', 'pie', 'scatter', 'area', 'histogram'];
  
  // Get actual column names from schema
  const validColumns = schema.columns
    .filter(c => c.role !== 'excluded')
    .map(c => c.name);
  
  // Normalize intent
  let intent = response.intent || 'analysis';
  if (!validIntents.includes(intent.toLowerCase())) {
    intent = 'analysis';
  }
  
  // Normalize chart type
  let chartType = (response.chart_type || 'bar').toLowerCase();
  if (!validChartTypes.includes(chartType)) {
    chartType = 'bar';
  }
  
  // Validate and filter columns_used
  let columnsUsed = response.columns_used || [];
  if (!Array.isArray(columnsUsed)) {
    columnsUsed = [];
  }
  columnsUsed = columnsUsed.filter(col => validColumns.includes(col));
  
  // Ensure we have at least some columns
  if (columnsUsed.length === 0 && validColumns.length > 0) {
    // Try to infer from the query
    const schemaLower = schema.columns.map(c => c.name.toLowerCase());
    const queryLower = (response.insight || '').toLowerCase();
    
    // Find columns mentioned in insight
    validColumns.forEach(col => {
      if (queryLower.includes(col.toLowerCase())) {
        columnsUsed.push(col);
      }
    });
  }
  
  // Normalize confidence
  let confidence = parseFloat(response.confidence) || 0.5;
  if (confidence < 0 || confidence > 1) {
    confidence = 0.5;
  }
  
  return {
    intent: intent,
    columns_used: columnsUsed,
    sql: response.sql || null,
    insight: response.insight || 'Analysis complete',
    chart_type: chartType,
    confidence: confidence,
    reasoning: response.reasoning || '',
    fallbackUsed: false,
  };
}

/**
 * Enhanced Ollama service class for AI router integration
 */
class OllamaAIService {
  constructor() {
    this.baseUrl = OLLAMA_BASE_URL;
    this.model = OLLAMA_MODEL;
    this.timeout = API_TIMEOUT;
  }

  async isAvailable() {
    return await isOllamaConfigured();
  }

  async generateResponse(prompt, context = {}) {
    try {
      // Validate that no actual data is being sent
      const validation = validateSchemaOnlyContext(context);
      if (!validation.isValid) {
        console.warn('Ollama AI service detected potential data leakage:', validation.violations);
      }

      const { dataset, schema } = context;
      
      if (!dataset || !schema) {
        return {
          success: false,
          error: 'Dataset and schema are required',
          provider: 'ollama',
        };
      }

      // Use schema-only approach
      const schemaInfo = extractSchemaForAI(dataset, schema);
      const systemPrompt = buildSchemaOnlyPrompt(prompt, schemaInfo);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: systemPrompt,
          stream: false,
          temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
          num_predict: parseInt(process.env.AI_MAX_TOKENS) || 2048,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.response?.trim() || '';

      return {
        success: true,
        content,
        provider: 'ollama',
        model: this.model,
      };
    } catch (error) {
      console.error('Ollama AI Error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'ollama',
      };
    }
  }

  async testConnection() {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          success: false,
          error: 'Ollama service not available',
        };
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: 'Hello, can you respond with "Connection successful"?',
          stream: false,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json();

      return {
        success: true,
        model: this.model,
        response: data.response?.trim() || '',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const ollamaAIService = new OllamaAIService();
