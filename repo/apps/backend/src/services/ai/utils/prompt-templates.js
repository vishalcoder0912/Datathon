// AI Prompt Templates for different use cases

export const PROMPT_TEMPLATES = {
  // Dataset analysis prompts
  datasetAnalysis: {
    schemaDetection: `Analyze this dataset and identify:
1. Column types (numeric, categorical, date, text)
2. Potential primary keys
3. Relationships between columns
4. Data quality issues
5. Recommended visualizations

Dataset sample:
{data}

Respond in JSON format with keys: columns, relationships, quality, visualizations`,

    correlationAnalysis: `Find correlations and patterns in this dataset:
{data}

Focus on:
1. Strong correlations (r > 0.7)
2. Interesting patterns
3. Anomalies or outliers
4. Business insights

Respond in JSON format with keys: correlations, patterns, anomalies, insights`,

    summaryGeneration: `Generate a comprehensive summary of this dataset:
{data}

Include:
1. Overview (row count, column count, memory usage)
2. Key statistics
3. Data distribution
4. Notable patterns
5. Recommendations for analysis

Respond in JSON format.`,

    outlierDetection: `Identify outliers in this dataset using statistical methods:
{data}

Methods to apply:
1. Z-score analysis
2. IQR method
3. Isolation forest (if applicable)

Respond in JSON format with keys: outliers, method, threshold, affected_rows`
  },

  // Chat prompts
  chat: {
    systemPrompt: `You are an AI data analyst assistant for InsightFlow. You help users:
1. Understand their data
2. Generate insights
3. Create visualizations
4. Answer questions about datasets
5. Provide recommendations

Always be helpful, accurate, and concise. When discussing data, reference specific values and patterns.`,

    contextPrompt: `Current dataset context:
- Dataset ID: {datasetId}
- Rows: {rowCount}
- Columns: {columnCount}
- Schema: {schema}

Previous conversation:
{conversationHistory}`,

    followUpPrompt: `Based on the previous analysis:
{previousAnalysis}

Answer this follow-up question:
{question}

Provide a detailed, data-driven response.`
  },

  // Visualization prompts
  visualization: {
    chartRecommendation: `Based on this dataset schema:
{schema}

Recommend the best charts to visualize:
1. Distribution of values
2. Relationships between variables
3. Trends over time (if applicable)
4. Comparisons

Respond in JSON format with keys: recommended_charts, reasoning, config`,

    colorScheme: `Suggest a color scheme for visualizing this data:
{data}

Consider:
1. Data type (categorical, sequential, diverging)
2. Accessibility (colorblind-friendly)
3. Aesthetic appeal

Respond with hex color codes in JSON format.`
  },

  // Predictive analytics prompts
  predictive: {
    forecasting: `Analyze this time series data and forecast future values:
{data}

Consider:
1. Trend analysis
2. Seasonality
3. Stationarity
4. Appropriate forecasting method

Provide forecast for next {periods} periods with confidence intervals.`,

    classification: `Based on this labeled dataset:
{data}

Build a classification model to predict {target}.

Suggest:
1. Best algorithm
2. Feature importance
3. Expected accuracy
4. Potential issues`
  },

  // Export prompts
  export: {
    reportGeneration: `Generate a professional report for this dataset analysis:
{analysis}

Include:
1. Executive summary
2. Methodology
3. Key findings
4. Visualizations
5. Recommendations
6. Appendix with technical details

Format in Markdown.`
  }
};

// Helper function to fill templates
export function fillTemplate(template, variables) {
  let filled = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    filled = filled.replace(new RegExp(placeholder, 'g'), value);
  }
  return filled;
}

// Get prompt by path
export function getPrompt(path, variables = {}) {
  const parts = path.split('.');
  let current = PROMPT_TEMPLATES;
  
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error(`Prompt template not found: ${path}`);
    }
    current = current[part];
  }
  
  if (typeof current !== 'string') {
    throw new Error(`Prompt template is not a string: ${path}`);
  }
  
  return fillTemplate(current, variables);
}

// Export default
export default PROMPT_TEMPLATES;
