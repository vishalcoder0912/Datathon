import { serviceUrls } from "../config/serviceUrls.js";

/**
 * Dual-Layer Validation Middleware for Llama 3.2
 * Optimized for 16GB RAM laptops
 * 
 * Layer 1: Query Parser - Converts natural language to analysis plan
 * Layer 2: Response Validator - Validates and corrects the analysis
 */

const OLLAMA_BASE_URL = serviceUrls.ollama;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const API_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS) || 60000;

class LlamaValidationMiddleware {
  constructor() {
    this.model = OLLAMA_MODEL;
    this.timeout = API_TIMEOUT;
    this.temperature = 0.1;
    this.cache = new Map();
  }

  /**
   * LAYER 1: Query Parser
   * Convert natural language to structured analysis
   */
  async parseQuery(userQuery, schema) {
    console.log('\n🔍 [LAYER 1] Parsing query with Llama 3.2...');
    console.log(`Query: "${userQuery}"`);

    const cacheKey = `parse_${userQuery}`;
    if (this.cache.has(cacheKey)) {
      console.log('✅ Using cached result');
      return this.cache.get(cacheKey);
    }

    const systemPrompt = `You are a data analytics expert. Convert user queries into structured JSON format.

SCHEMA AVAILABLE:
${this.formatSchema(schema)}

RESPOND WITH JSON ONLY (no other text):
{
  "intent": "aggregation|comparison|trend|distribution|count|filter|unclear",
  "primary_column": "column_name",
  "secondary_column": "column_name_or_null",
  "aggregation": "sum|avg|count|min|max",
  "chart_type": "bar|line|pie|scatter|histogram|table",
  "filters": [],
  "top_n": 10,
  "confidence": 0.8,
  "reasoning": "brief explanation"
}`;

    const userPrompt = `Convert this query: "${userQuery}"`;

    try {
      const response = await this.callLlama(
        `${systemPrompt}\n\n${userPrompt}`,
        300
      );

      const parsed = this.extractJSON(response);
      
      const validationErrors = this.validateColumns(parsed, schema);
      if (validationErrors.length > 0) {
        console.warn('⚠️  Column validation errors:', validationErrors);
        parsed.validation_errors = validationErrors;
      }

      const result = {
        success: true,
        data: parsed,
        layer: 'parser',
      };

      this.cache.set(cacheKey, result);
      console.log('✅ Query parsed successfully');
      return result;

    } catch (error) {
      console.error('❌ Parse error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: this.getDefaultParsing(userQuery, schema),
      };
    }
  }

  /**
   * LAYER 2: Response Validator
   * Validate and correct the analysis
   */
  async validateAndCorrect(queryResult, schema, dataset) {
    console.log('\n✅ [LAYER 2] Validating analysis with Llama 3.2...');

    const cacheKey = `validate_${JSON.stringify(queryResult)}`;
    if (this.cache.has(cacheKey)) {
      console.log('✅ Using cached validation');
      return this.cache.get(cacheKey);
    }

    const systemPrompt = `You are a data validation expert. Review and correct this query analysis.

SCHEMA:
${this.formatSchema(schema)}

VALIDATION RULES:
1. All columns must exist in schema
2. Aggregation must match column type (numeric for sum/avg)
3. Chart type must suit the data
4. Filters must be valid

RESPOND WITH JSON ONLY:
{
  "valid": true/false,
  "corrected": { ...corrected_analysis... },
  "errors": ["error1"],
  "corrections": ["what_was_fixed"],
  "validation_score": 0.85,
  "warnings": ["warning1"]
}`;

    const userPrompt = `Review this analysis:
${JSON.stringify(queryResult, null, 2)}`;

    try {
      const response = await this.callLlama(
        `${systemPrompt}\n\n${userPrompt}`,
        350
      );

      const validated = this.extractJSON(response);

      const result = {
        success: true,
        valid: validated.valid,
        corrected: validated.corrected || queryResult,
        errors: validated.errors || [],
        corrections: validated.corrections || [],
        score: validated.validation_score || 0.7,
        warnings: validated.warnings || [],
        layer: 'validator',
      };

      this.cache.set(cacheKey, result);

      if (result.valid) {
        console.log(`✅ Validation passed (score: ${result.score})`);
      } else {
        console.log(`⚠️  Validation failed - using corrections`);
        console.log(`Corrections made: ${result.corrections.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error('❌ Validation error:', error.message);
      return {
        success: false,
        error: error.message,
        valid: null,
        corrected: queryResult,
        score: 0.5,
      };
    }
  }

  /**
   * MAIN PIPELINE: Process query through both layers
   */
  async processQuery(userQuery, dataset, schema) {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  🚀 LLAMA 3.2 VALIDATION PIPELINE START  ║');
    console.log('╚════════════════════════════════════════════╝');

    const parseResult = await this.parseQuery(userQuery, schema);
    
    if (!parseResult.success) {
      console.error('❌ Query parsing failed');
      return {
        success: false,
        error: 'Failed to parse query',
        fallback: parseResult.fallback,
      };
    }

    const queryData = parseResult.data;

    const validationResult = await this.validateAndCorrect(
      queryData,
      schema,
      dataset
    );

    if (!validationResult.success) {
      console.warn('⚠️  Validation had issues, but continuing with corrections');
    }

    const correctedAnalysis = validationResult.corrected || queryData;

    console.log('\n📊 Generating dashboard...');
    const dashboard = this.generateDashboard(
      correctedAnalysis,
      dataset,
      schema,
      { parseResult, validationResult }
    );

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  ✨ PIPELINE COMPLETE - DASHBOARD READY  ║');
    console.log('╚════════════════════════════════════════════╝\n');

    return dashboard;
  }

  /**
   * Generate final dashboard
   */
  generateDashboard(analysis, dataset, schema, metadata) {
    const { primary_column, secondary_column, aggregation, chart_type, intent } = analysis;

    if (!primary_column) {
      return {
        success: false,
        error: 'No primary column identified',
      };
    }

    const chartData = this.buildChartData(
      dataset.rows || [],
      primary_column,
      secondary_column,
      aggregation || 'sum'
    );

    if (chartData.length === 0) {
      return {
        success: false,
        error: 'No data to display',
      };
    }

    return {
      success: true,
      analysis: analysis,
      chart: {
        type: chart_type || 'bar',
        title: this.generateChartTitle(analysis),
        data: chartData,
        xKey: primary_column,
        yKey: secondary_column || 'value',
        config: {
          responsive: true,
          maintainAspectRatio: true,
        },
      },
      sql: this.generateSQL(analysis),
      metadata: {
        model: this.model,
        validation_score: metadata.validationResult?.score,
        parser_confidence: analysis.confidence,
        errors_corrected: metadata.validationResult?.corrections?.length || 0,
        overall_confidence: Math.min(
          analysis.confidence || 0.7,
          metadata.validationResult?.score || 0.7
        ),
        warnings: metadata.validationResult?.warnings || [],
      },
    };
  }

  /**
   * Build chart data from dataset
   */
  buildChartData(rows, primaryCol, secondaryCol, aggregation) {
    if (!rows || rows.length === 0 || !primaryCol) return [];

    const grouped = {};

    rows.forEach(row => {
      const key = String(row[primaryCol] || 'Unknown');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });

    return Object.entries(grouped)
      .map(([key, groupRows]) => {
        let value = 0;

        if (secondaryCol && aggregation !== 'count') {
          const values = groupRows
            .map(r => Number(r[secondaryCol]))
            .filter(v => !isNaN(v));

          if (values.length > 0) {
            if (aggregation === 'sum' || !aggregation) {
              value = values.reduce((a, b) => a + b, 0);
            } else if (aggregation === 'avg' || aggregation === 'average') {
              value = values.reduce((a, b) => a + b, 0) / values.length;
            } else if (aggregation === 'min') {
              value = Math.min(...values);
            } else if (aggregation === 'max') {
              value = Math.max(...values);
            } else {
              value = values.length;
            }
          }
        } else {
          value = groupRows.length;
        }

        return {
          [primaryCol]: key,
          value: Math.round(value * 100) / 100,
          count: groupRows.length,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }

  /**
   * Generate chart title
   */
  generateChartTitle(analysis) {
    const { primary_column, secondary_column, aggregation, intent } = analysis;
    const agg = (aggregation || 'sum').toUpperCase();
    const metric = secondary_column ? ` of ${secondary_column}` : '';
    return `${agg}${metric} by ${primary_column}`.trim();
  }

  /**
   * Generate SQL from analysis
   */
  generateSQL(analysis) {
    const { primary_column, secondary_column, aggregation } = analysis;

    if (!primary_column) return 'SELECT * FROM dataset_rows LIMIT 100';

    let sql = 'SELECT ';

    if (aggregation === 'sum') {
      sql += `${primary_column}, SUM(${secondary_column || 'value'}) as total`;
    } else if (aggregation === 'avg' || aggregation === 'average') {
      sql += `${primary_column}, AVG(${secondary_column || 'value'}) as average`;
    } else if (aggregation === 'count') {
      sql += `${primary_column}, COUNT(*) as count`;
    } else if (aggregation === 'min') {
      sql += `${primary_column}, MIN(${secondary_column || 'value'}) as minimum`;
    } else if (aggregation === 'max') {
      sql += `${primary_column}, MAX(${secondary_column || 'value'}) as maximum`;
    } else {
      sql += `${primary_column}, ${secondary_column || '*'}`;
    }

    sql += ` FROM dataset_rows`;
    sql += ` GROUP BY ${primary_column}`;
    sql += ` ORDER BY ${aggregation === 'count' ? 'count' : secondary_column || 'value'} DESC`;

    return sql;
  }

  /**
   * Call Ollama Llama 3.2
   */
  async callLlama(prompt, maxTokens = 300) {
    console.log(`📡 Calling Llama 3.2 (max ${maxTokens} tokens)...`);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature: this.temperature,
          top_k: 40,
          top_p: 0.9,
          num_predict: maxTokens,
          repeat_penalty: 1.1,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.response) {
        throw new Error('Empty response from Llama');
      }

      return data.response;

    } catch (error) {
      console.error('❌ Llama API error:', error.message);
      throw error;
    }
  }

  /**
   * Extract JSON from response
   */
  extractJSON(text) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(match[0]);
    } catch (error) {
      console.error('❌ JSON extraction error:', error.message);
      console.log('Response was:', text.substring(0, 200));
      throw error;
    }
  }

  /**
   * Format schema for prompt
   */
  formatSchema(schema) {
    if (!schema) return 'No schema available';
    
    const cols = schema.columns || [];
    const colList = cols.map(col => `- ${col.name} (${col.type})`).join('\n');
    
    return `Dataset: ${schema.datasetName || 'Unknown'}
Rows: ${schema.rowCount || 0}
Columns: ${schema.columnCount || cols.length}

Columns:
${colList || 'No columns'}

Primary Dimension: ${schema.primaryDimension?.name || schema.primaryMetric?.name || 'None'}
Primary Metric: ${schema.primaryMetric?.name || 'None'}`;
  }

  /**
   * Validate columns exist in schema
   */
  validateColumns(parsed, schema) {
    const errors = [];
    if (!schema?.columns) return errors;
    
    const columnNames = new Set(
      schema.columns.map(c => c.name.toLowerCase())
    );

    const checkColumn = (col, type) => {
      if (!col) return;
      if (!columnNames.has(col.toLowerCase())) {
        errors.push(`${type} column "${col}" not found in schema`);
      }
    };

    checkColumn(parsed.primary_column, 'Primary');
    checkColumn(parsed.secondary_column, 'Secondary');

    return errors;
  }

  /**
   * Default parsing fallback
   */
  getDefaultParsing(query, schema) {
    const lower = query.toLowerCase();
    
    let intent = 'aggregation';
    if (lower.includes('trend') || lower.includes('over time')) intent = 'trend';
    if (lower.includes('compare') || lower.includes('vs')) intent = 'comparison';
    if (lower.includes('top') || lower.includes('best')) intent = 'ranking';
    if (lower.includes('count') || lower.includes('how many')) intent = 'count';

    const firstCol = schema?.columns?.[0]?.name || 'column1';
    const secondCol = schema?.columns?.[1]?.name || null;

    return {
      intent,
      primary_column: firstCol,
      secondary_column: secondCol,
      aggregation: 'sum',
      chart_type: 'bar',
      filters: [],
      top_n: 10,
      confidence: 0.3,
      reasoning: 'Fallback parsing - query too complex',
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

export const llamaValidationMiddleware = new LlamaValidationMiddleware();
export default LlamaValidationMiddleware;