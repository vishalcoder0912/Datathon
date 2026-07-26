class LocalNLPService {
  constructor() {
    this.enabled = process.env.LOCAL_NLP_ENABLED === 'true';
  }

  async isAvailable() {
    return this.enabled;
  }

  async generateResponse(prompt, context = {}) {
    try {
      if (!this.enabled) {
        return {
          success: false,
          error: 'Local NLP service is disabled',
          provider: 'local',
        };
      }

      // Use schema-only context for consistency
      const sanitizedContext = { ...context };
      if (sanitizedContext.dataset && sanitizedContext.dataset.rows) {
        delete sanitizedContext.dataset.rows;
      }
      
      const analysis = this.analyzeQuery(prompt, sanitizedContext);
      const response = this.generateLocalResponse(analysis, sanitizedContext);

      return {
        success: true,
        content: response,
        provider: 'local',
        model: 'rule-based',
      };
    } catch (error) {
      console.error('Local NLP Error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'local',
      };
    }
  }

  analyzeQuery(prompt, context) {
    const { dataset, schema } = context;
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    const analysis = {
      intent: 'general',
      entities: [],
      metrics: [],
      dimensions: [],
      timeframes: [],
      aggregations: [],
      chartTypes: [],
    };

    // Detect intent
    if (normalizedPrompt.includes('trend') || normalizedPrompt.includes('over time') || normalizedPrompt.includes('monthly')) {
      analysis.intent = 'trend';
      analysis.chartTypes.push('line', 'area');
    }
    if (normalizedPrompt.includes('compare') || normalizedPrompt.includes('difference')) {
      analysis.intent = 'comparison';
      analysis.chartTypes.push('bar');
    }
    if (normalizedPrompt.includes('distribution') || normalizedPrompt.includes('breakdown')) {
      analysis.intent = 'distribution';
      analysis.chartTypes.push('pie', 'donut');
    }
    if (normalizedPrompt.includes('correlation') || normalizedPrompt.includes('relationship')) {
      analysis.intent = 'correlation';
      analysis.chartTypes.push('scatter');
    }

    // Extract metrics and dimensions from schema
    if (schema) {
      schema.columns.forEach(column => {
        const columnName = column.name.toLowerCase();
        if (normalizedPrompt.includes(columnName)) {
          if (column.role === 'metric') {
            analysis.metrics.push(column.name);
          } else if (column.role === 'dimension') {
            analysis.dimensions.push(column.name);
          }
        }
      });
    }

    // Detect aggregations
    if (normalizedPrompt.includes('sum') || normalizedPrompt.includes('total')) {
      analysis.aggregations.push('sum');
    }
    if (normalizedPrompt.includes('average') || normalizedPrompt.includes('mean')) {
      analysis.aggregations.push('avg');
    }
    if (normalizedPrompt.includes('count')) {
      analysis.aggregations.push('count');
    }
    if (normalizedPrompt.includes('maximum') || normalizedPrompt.includes('highest')) {
      analysis.aggregations.push('max');
    }
    if (normalizedPrompt.includes('minimum') || normalizedPrompt.includes('lowest')) {
      analysis.aggregations.push('min');
    }

    // Detect timeframes
    const timePatterns = [
      { pattern: 'daily|day', timeframe: 'daily' },
      { pattern: 'weekly|week', timeframe: 'weekly' },
      { pattern: 'monthly|month', timeframe: 'monthly' },
      { pattern: 'quarterly|quarter', timeframe: 'quarterly' },
      { pattern: 'yearly|year', timeframe: 'yearly' },
    ];

    timePatterns.forEach(({ pattern, timeframe }) => {
      if (new RegExp(pattern).test(normalizedPrompt)) {
        analysis.timeframes.push(timeframe);
      }
    });

    return analysis;
  }

  generateLocalResponse(analysis, context) {
    const { dataset, schema } = context;
    let response = '';

    switch (analysis.intent) {
      case 'trend':
        response = this.generateTrendResponse(analysis, context);
        break;
      case 'comparison':
        response = this.generateComparisonResponse(analysis, context);
        break;
      case 'distribution':
        response = this.generateDistributionResponse(analysis, context);
        break;
      case 'correlation':
        response = this.generateCorrelationResponse(analysis, context);
        break;
      default:
        response = this.generateGeneralResponse(analysis, context);
    }

    return response;
  }

  generateTrendResponse(analysis, context) {
    const { dataset } = context;
    const metrics = analysis.metrics.length > 0 ? analysis.metrics : ['value'];
    const dimensions = analysis.dimensions.length > 0 ? analysis.dimensions : ['date'];
    
    return `Based on your trend analysis request, I can see you want to analyze ${metrics.join(' and ')} over time. 

To visualize this trend, I recommend using a ${analysis.chartTypes[0] || 'line'} chart with ${dimensions[0]} on the x-axis and ${metrics[0]} on the y-axis.

SQL Query Example:
` + "```sql\n" +
`SELECT 
  ${dimensions[0]},
  ${analysis.aggregations[0] || 'SUM'}(${metrics[0]}) as ${metrics[0]}
FROM your_table
GROUP BY ${dimensions[0]}
ORDER BY ${dimensions[0]}
` + "```\n" +
`This will show you how ${metrics[0]} changes over ${dimensions[0]}. Would you like me to help you analyze any specific patterns or periods?`;
  }

  generateComparisonResponse(analysis, context) {
    const metrics = analysis.metrics.length > 0 ? analysis.metrics : ['value'];
    const dimensions = analysis.dimensions.length > 0 ? analysis.dimensions.slice(0, 2) : ['category'];
    
    return `For your comparison analysis, I'll help you compare ${metrics.join(' and ')} across different ${dimensions[0]} values.

I recommend using a bar chart to clearly show the differences between categories.

SQL Query Example:
` + "```sql\n" +
`SELECT 
  ${dimensions[0]},
  ${analysis.aggregations[0] || 'AVG'}(${metrics[0]}) as average_${metrics[0]}
FROM your_table
GROUP BY ${dimensions[0]}
ORDER BY average_${metrics[0]} DESC
` + "```\n" +
`This query will show you the average ${metrics[0]} for each ${dimensions[0]}, making it easy to identify the highest and lowest values. Would you like to focus on any specific comparisons?`;
  }

  generateDistributionResponse(analysis, context) {
    const dimensions = analysis.dimensions.length > 0 ? analysis.dimensions : ['category'];
    
    return `To analyze the distribution across ${dimensions[0]}, I recommend using a ${analysis.chartTypes[0] || 'pie'} chart to show the proportion of each category.

SQL Query Example:
` + "```sql\n" +
`SELECT 
  ${dimensions[0]},
  COUNT(*) as count
FROM your_table
GROUP BY ${dimensions[0]}
ORDER BY count DESC
` + "```\n" +
`This will show you how many records belong to each ${dimensions[0]} category, helping you understand the data distribution. Would you like me to highlight any specific patterns in the distribution?`;
  }

  generateCorrelationResponse(analysis, context) {
    const metrics = analysis.metrics.length >= 2 ? analysis.metrics : ['value1', 'value2'];
    
    return `For correlation analysis between ${metrics[0]} and ${metrics[1]}, I recommend using a scatter plot to visualize the relationship.

SQL Query Example:
` + "```sql\n" +
`SELECT 
  ${metrics[0]},
  ${metrics[1]}
FROM your_table
WHERE ${metrics[0]} IS NOT NULL 
  AND ${metrics[1]} IS NOT NULL
` + "```\n" +
`This will help you identify patterns, trends, or correlations between these two variables. A positive correlation would show points trending upward from left to right, while a negative correlation would trend downward. Would you like me to help calculate the correlation coefficient?`;
  }

  generateGeneralResponse(analysis, context) {
    const { schema } = context;
    
    if (!schema) {
      return `I can help you analyze your data! To get started, please upload a dataset or create a demo dataset. Once you have data loaded, I can assist with:

- Trend analysis over time
- Comparisons between categories  
- Data distribution analysis
- Correlation analysis between variables
- Generating SQL queries
- Creating chart recommendations

What would you like to explore?`;
    }

    const columnCount = schema.columns?.length || 0;
    const rowCount = context.dataset?.rowCount || 'unknown';
    const dimensions = schema.columns?.filter(col => col.role === 'dimension') || [];
    const metrics = schema.columns?.filter(col => col.role === 'metric') || [];
    
    return `I can help you analyze your dataset which contains ${rowCount} rows and ${columnCount} columns based on its schema structure.

**Schema Analysis:**
- Dimensions available: ${dimensions.map(col => col.name).join(', ') || 'none'}
- Metrics available: ${metrics.map(col => col.name).join(', ') || 'none'}

**Available Analysis Types:**
- **Trend Analysis**: Track metrics over time periods
- **Comparison**: Compare values across categories
- **Distribution**: Understand data spread and proportions
- **Correlation**: Find relationships between variables

**Quick SQL Examples:**
` + "```sql\n" +
`-- Get basic statistics
SELECT COUNT(*) as total_rows FROM your_table;

-- Find top categories
SELECT category, COUNT(*) as count 
FROM your_table 
GROUP BY category 
ORDER BY count DESC 
LIMIT 10;
` + "```\n" +
`What specific aspect of your data would you like to explore? I can generate targeted queries and visualizations based on your schema structure.`;
  }

  async testConnection() {
    return {
      success: this.enabled,
      model: 'rule-based',
      status: this.enabled ? 'enabled' : 'disabled',
    };
  }
}

export const localNLPService = new LocalNLPService();
