import { GoogleGenerativeAI } from '@google/generative-ai';

const readGeminiApiKey = () =>
  process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(readGeminiApiKey());
let hasLoggedMissingGeminiConfig = false;

/**
 * Schema-first system prompt for InsightFlow AI
 * Configures Gemini to act as a senior data analyst with structured JSON output
 */
const INSIGHTFLOW_SYSTEM_PROMPT = `
You are InsightFlow AI — a schema-first senior data analyst.
You do not guess. You do not hallucinate. You reason from schema only.

## Your Identity
You think like a data analyst, not a chatbot.
You receive a dataset schema packet and a natural language question.
You return ONLY valid JSON. No markdown. No preamble. No explanation outside JSON.

## Output Format (STRICT — never deviate)
{
  "intent": "aggregation | filter | comparison | distribution | correlation | count | trend | unclear",
  "columns_used": ["exact_column_name_from_schema"],
  "sql": "SELECT ... FROM dataset WHERE ... GROUP BY ... ORDER BY ...",
  "insight": "1-2 sentence plain English explanation of what the result shows and why it matters.",
  "chart_type": "bar | line | pie | histogram | scatter | table",
  "confidence": 0.0
}

## Column Rules
- ONLY use column names that appear in the schema JSON
- If a user says 'salary', map to the exact column name (e.g. salary_usd)
- Never invent column aliases not in schema

## SQL Rules
- Table name is always: dataset
- Use standard SQL (SQLite-compatible)
- Aggregation questions → GROUP BY with AVG/COUNT/SUM
- Comparison questions → GROUP BY with ORDER BY
- Distribution questions → COUNT(*) GROUP BY with ORDER BY count DESC
- Correlation hints → use both numeric columns, compute AVG per category

## Chart Selection Rules
- Categorical comparison → bar
- Trend over time → line only when a real date/time column exists
- Part of whole → pie (only for <8 categories)
- Single numeric distribution → histogram
- Two numeric relationship → scatter
- Many columns or raw data → table
- Never use __row_index__ as a trend or business dimension
- Never promote schema profile metrics such as Attributes / Columns, Numeric Columns, Categorical Columns, Missing Values, or Data Quality Score into business dashboard KPIs

## Unanswerable Queries
If the question cannot be answered from the schema, return:
{
  "intent": "unclear",
  "columns_used": [],
  "sql": "",
  "insight": "Explain exactly why this cannot be answered from the available schema.",
  "chart_type": "table",
  "confidence": 0.0
}

## Confidence Score
- 0.9-1.0: Direct mapping, clear intent, all columns found
- 0.7-0.89: Minor ambiguity resolved with reasonable assumption
- 0.5-0.69: Multiple interpretations possible, chose most likely
- Below 0.5: Significant uncertainty, explain in insight
`;

/**
 * Validates that the payload contains only schema, no data rows
 * @param {Object} payload - The payload to validate
 * @throws {Error} If payload contains data rows
 */
const validateSchemaOnlyPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }

  // Check for common data row keys that should not be present
  const forbiddenKeys = ['rows', 'data', 'records', 'items', 'values'];
  for (const key of forbiddenKeys) {
    if (key in payload) {
      throw new Error(`Security violation: payload contains "${key}" - data rows are not allowed`);
    }
  }

  // Validate schema structure
  if (!payload.schema || typeof payload.schema !== 'object') {
    throw new Error('Invalid payload: schema is required and must be an object');
  }

  if (!Array.isArray(payload.schema.columns)) {
    throw new Error('Invalid schema: columns must be an array');
  }

  // Ensure columns don't contain actual data
  for (const column of payload.schema.columns) {
    if (column.data || column.values || column.rows) {
      throw new Error(`Security violation: column "${column.name}" contains data`);
    }
  }
};

/**
 * Formats schema for AI prompt
 * @param {Object} schema - Dataset schema
 * @returns {string} Formatted schema description
 */
const formatSchemaForAI = (schema) => {
  const columns = schema.columns || [];
  const columnDescriptions = columns.map(col => {
    const samples = col.sample ? ` (examples: ${col.sample.slice(0, 3).join(', ')})` : '';
    return `- ${col.name} (${col.type}${samples})`;
  }).join('\n');

  return `Dataset: ${schema.datasetName || 'Unknown'}
Columns:
${columnDescriptions}
Total columns: ${columns.length}`;
};

const buildFallbackSchemaResponse = (schemaPacket, query, reason) => {
  const columns = Array.isArray(schemaPacket?.columns) ? schemaPacket.columns : [];
  const loweredQuery = String(query || "").toLowerCase();
  const numericCols = columns.filter(col => col.type === "number");
  const categoricalCols = columns.filter(col => col.type === "string");
  const metricCol = numericCols[0];
  const dimensionCol = categoricalCols[0];

  let intent = "unclear";
  let sql = "";
  let insight = reason || "AI SQL generation is unavailable for this request.";
  let chart_type = "table";
  let confidence = 0.35;
  let columns_used = [];

  if (metricCol && /\b(avg|average|mean)\b/.test(loweredQuery)) {
    intent = dimensionCol ? "comparison" : "aggregation";
    sql = dimensionCol
      ? `SELECT "${dimensionCol.name}", AVG("${metricCol.name}") AS average_${metricCol.name} FROM dataset GROUP BY "${dimensionCol.name}" ORDER BY average_${metricCol.name} DESC`
      : `SELECT AVG("${metricCol.name}") AS average_${metricCol.name} FROM dataset`;
    insight = reason || `Returning a schema-based fallback query for average ${metricCol.name}.`;
    chart_type = dimensionCol ? "bar" : "table";
    confidence = 0.6;
    columns_used = dimensionCol ? [dimensionCol.name, metricCol.name] : [metricCol.name];
  } else if (dimensionCol && /\b(count|how many|number of)\b/.test(loweredQuery)) {
    intent = "count";
    sql = `SELECT "${dimensionCol.name}", COUNT(*) AS count FROM dataset GROUP BY "${dimensionCol.name}" ORDER BY count DESC`;
    insight = reason || `Returning a schema-based fallback count grouped by ${dimensionCol.name}.`;
    chart_type = "bar";
    confidence = 0.6;
    columns_used = [dimensionCol.name];
  }

  return {
    intent,
    sql,
    insight,
    chart_type,
    confidence,
    columns_used,
    fallback: true,
  };
};

/**
 * Generates structured SQL response from natural language using schema-first Gemini AI
 * @param {Object} schemaPacket - Dataset schema packet from buildSchemaPacket()
 * @param {string} query - Natural language query
 * @param {Object} options
 * @param {boolean} options.allowFallback - When false, propagate Gemini failures instead of returning a schema fallback
 * @returns {Promise<Object>} Structured response with SQL, insight, chart_type, confidence
 */
export const generateSQLFromSchema = async (schemaPacket, query, options = {}) => {
  const { allowFallback = true } = options;

  if (!readGeminiApiKey()) {
    if (!allowFallback) {
      throw new Error('Gemini API key not configured');
    }

    if (!hasLoggedMissingGeminiConfig) {
      console.warn('[schema-ai] Gemini API key not configured, returning fallback response');
      hasLoggedMissingGeminiConfig = true;
    }
    return buildFallbackSchemaResponse(
      schemaPacket,
      query,
      'Gemini API key not configured. Returning a schema-based fallback response.'
    );
  }

  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  if (!schemaPacket || !schemaPacket.columns) {
    throw new Error('Valid schema packet is required');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      },
      systemInstruction: INSIGHTFLOW_SYSTEM_PROMPT
    });

    const result = await model.generateContent(
      `Schema: ${JSON.stringify(schemaPacket)}\nQuestion: ${query}`
    );
    
    const response = await result.response;
    const responseText = response.text();
    
    // Parse JSON response safely
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from Gemini: ${responseText}`);
    }

    // Validate required fields
    const requiredFields = ['intent', 'columns_used', 'sql', 'insight', 'chart_type', 'confidence'];
    for (const field of requiredFields) {
      if (!(field in parsedResponse)) {
        throw new Error(`Missing required field in Gemini response: ${field}`);
      }
    }

    // Validate SQL contains only schema columns
    const schemaColumns = schemaPacket.columns.map(col => col.name);
    const usedColumns = parsedResponse.columns_used || [];
    
    for (const col of usedColumns) {
      if (!schemaColumns.includes(col)) {
        throw new Error(`Gemini used non-existent column: ${col}`);
      }
    }

    // Basic SQL validation
    if (parsedResponse.sql && !parsedResponse.sql.toLowerCase().startsWith('select')) {
      throw new Error('Generated SQL must start with SELECT');
    }

    return {
      intent: parsedResponse.intent,
      sql: parsedResponse.sql || '',
      insight: parsedResponse.insight || '',
      chart_type: parsedResponse.chart_type || 'table',
      confidence: parsedResponse.confidence || 0.0,
      columns_used: parsedResponse.columns_used || []
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    console.warn(`[schema-ai] Falling back after AI generation failure: ${error.message}`);
    return buildFallbackSchemaResponse(
      schemaPacket,
      query,
      `AI generation failed. Returning a schema-based fallback response.`
    );
  }
};

/**
 * Validates SQL query before execution
 * @param {string} sql - SQL query to validate
 * @returns {Object} Validation result
 */
export const validateSQLQuery = (sql) => {
  const errors = [];
  const warnings = [];

  if (!sql || typeof sql !== 'string') {
    errors.push('SQL query must be a string');
    return { valid: false, errors, warnings };
  }

  // Check for dangerous operations
  const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
  const upperSQL = sql.toUpperCase();

  for (const keyword of dangerousKeywords) {
    if (upperSQL.includes(keyword)) {
      errors.push(`Dangerous keyword detected: ${keyword}`);
    }
  }

  // Check for multiple statements
  if (sql.includes(';') && sql.trim().endsWith(';') === false) {
    warnings.push('Multiple SQL statements detected');
  }

  // Check for subqueries that might be complex
  if ((sql.match(/\(/g) || []).length > 4) {
    warnings.push('Complex query with many subqueries');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
