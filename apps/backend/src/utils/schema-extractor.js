/**
 * Schema extraction utilities for AI interactions
 * Ensures only schema information (not actual data) is sent to AI services
 */

/**
 * Extract schema information for AI analysis
 */
export const extractSchemaForAI = (dataset, schema) => {
  // Classify columns properly
  const columns = (schema.columns || []).map(col => {
    const name = col.name || '';
    const type = col.type || 'string';
    
    let role = col.role || 'dimension';
    
    // Better classification for common column patterns
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
      type: col.type,
      role: role,
      sampleValues: col.sample ? Array.isArray(col.sample) ? col.sample.slice(0, 3) : [col.sample] : []
    };
  });

  return {
    dataset: {
      name: dataset.name,
      rowCount: dataset.rowCount || dataset.rows?.length || 0,
      columnCount: columns.length,
    },
    schema: {
      columns: columns,
      primaryDimension: columns.find(col => col.role === 'dimension'),
      secondaryDimension: columns.filter(col => col.role === 'dimension')[1] || null,
      primaryMetric: columns.find(col => col.role === 'metric'),
      secondaryMetric: columns.filter(col => col.role === 'metric')[1] || null,
    },
    dataSummary: {
      totalRows: dataset.rowCount || dataset.rows?.length || 0,
      totalColumns: columns.length,
      metrics: columns.filter(col => col.role === 'metric').map(c => c.name),
      dimensions: columns.filter(col => col.role === 'dimension').map(c => c.name),
      excluded: columns.filter(col => col.role === 'excluded').map(c => c.name),
    }
  };
};

export const sanitizeQueryContext = (context) => {
  // Remove any actual data rows from context
  const sanitized = { ...context };
  
  if (sanitized.dataset && sanitized.dataset.rows) {
    delete sanitized.dataset.rows;
  }
  
  if (sanitized.analyticsDataset && sanitized.analyticsDataset.rows) {
    delete sanitized.analyticsDataset.rows;
  }
  
  // Ensure we only have schema information
  if (sanitized.schema && sanitized.dataset) {
    sanitized.schemaOnly = extractSchemaForAI(sanitized.dataset, sanitized.schema);
  }
  
  return sanitized;
};

/**
 * Build schema-only prompt with better guidance for HR data
 */
export const buildSchemaOnlyPrompt = (query, schemaInfo) => {
  const { dataset, schema, dataSummary } = schemaInfo;
  
  const metrics = dataSummary.metrics || [];
  const dimensions = dataSummary.dimensions || [];
  const excluded = dataSummary.excluded || [];
  
  let prompt = `You are analyzing a dataset using SCHEMA-ONLY information. You do NOT have access to actual data values.

Dataset Information:
- Name: ${dataset.name}
- Total Rows: ${dataset.rowCount || 0}
- Total Columns: ${dataset.columnCount || 0}

SCHEMA CLASSIFICATION:
`;
  
  if (metrics.length > 0) {
    prompt += `\nMETRIC COLUMNS (use for aggregation - SUM, AVG, COUNT, MIN, MAX):
${metrics.map(m => `  - ${m}`).join('\n')}`;
  }
  
  if (dimensions.length > 0) {
    prompt += `\nDIMENSION COLUMNS (use for grouping - GROUP BY):
${dimensions.map(d => `  - ${d}`).join('\n')}`;
  }
  
  if (excluded.length > 0) {
    prompt += `\nEXCLUDED COLUMNS (do NOT use in charts or queries):
${excluded.map(e => `  - ${e}`).join('\n')}`;
  }

  prompt += `

COMMON ANALYSIS PATTERNS:
- "Salary by country" → SELECT country, AVG(salary_usd) FROM data GROUP BY country
- "Top experience levels" → SELECT country, MAX(experience) FROM data GROUP BY country
- "Education distribution" → SELECT education, COUNT(*) FROM data GROUP BY education

CHART TYPE GUIDANCE:
- bar: comparing values across categories (salary by country)
- line: trends over time or sequence (if time/date column exists)
- pie: proportions of a whole (education breakdown)
- scatter: correlation between two numeric values (experience vs salary)

IMPORTANT RULES:
1. NEVER use excluded columns (id, row_id, index) in queries or charts
2. Only reference columns that exist in the schema above
3. Numeric columns are for metrics, string columns are for dimensions
4. Always match column names exactly (case-sensitive)

User Query: ${query}

Provide a helpful response with appropriate SQL query and chart suggestion.`;

  return prompt;
};

export const validateSchemaOnlyContext = (context) => {
  // Ensure no actual data is being sent to AI
  const forbiddenKeys = ['rows', 'data', 'actualData', 'realData'];
  const violations = [];
  
  const checkObject = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (forbiddenKeys.includes(key.toLowerCase())) {
        violations.push(`Found potential data at path: ${currentPath}`);
      }
      
      if (Array.isArray(value) && key.toLowerCase().includes('row')) {
        violations.push(`Found potential row data at path: ${currentPath}`);
      }
      
      if (typeof value === 'object' && value !== null) {
        checkObject(value, currentPath);
      }
    }
  };
  
  checkObject(context);
  
  return {
    isValid: violations.length === 0,
    violations,
  };
};
