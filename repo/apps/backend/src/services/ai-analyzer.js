import { ollamaService } from './ai-providers/ollama-service.js';
import { geminiService } from './ai-providers/gemini-service.js';
import { buildEnhancedSchema, detectDataType } from './schema-detector.js';

class AIAnalyzer {
  constructor() {
    this.aiProvider = null;
    this.initPromise = this.initializeProvider();
  }

  async initializeProvider() {
    try {
      const ollamaAvailable = await ollamaService.isAvailable();
      if (ollamaAvailable) {
        this.aiProvider = 'ollama';
        console.log('AI Analyzer: Using Ollama');
        return;
      }

      const geminiAvailable = await geminiService.isAvailable();
      if (geminiAvailable) {
        this.aiProvider = 'gemini';
        console.log('AI Analyzer: Using Gemini');
        return;
      }

      this.aiProvider = null;
      console.log('AI Analyzer: Using rule-based analysis only');
    } catch (error) {
      console.error('AI Provider initialization error:', error);
      this.aiProvider = null;
    }
  }

  async analyzeDataset(columns, rows, existingSchema = null) {
    await this.initPromise;
    
    const schema = existingSchema || buildEnhancedSchema(columns, rows);
    
    const analysisResult = {
      schema,
      chartRecommendations: schema.recommendedCharts || [],
      insights: schema.insights || [],
      aiInsights: null,
      generatedAt: new Date().toISOString()
    };

    if (this.aiProvider) {
      try {
        const aiAnalysis = await this.performAIAnalysis(columns, rows, schema);
        analysisResult.aiInsights = aiAnalysis;
      } catch (error) {
        console.error('AI Analysis failed:', error.message);
        analysisResult.aiInsights = {
          error: error.message,
          fallback: 'Rule-based analysis available'
        };
      }
    }

    return analysisResult;
  }

  async performAIAnalysis(columns, rows, schema) {
    const dataSummary = this.createDataSummary(columns, rows, schema);
    const prompt = this.buildAnalysisPrompt(dataSummary);

    let response;
    if (this.aiProvider === 'ollama') {
      response = await ollamaService.generateResponse(prompt, {
        dataset: { columns: columns.map(c => c.name), rowCount: rows.length },
        schema
      });
    } else if (this.aiProvider === 'gemini') {
      response = await geminiService.generateResponse(prompt, {
        dataset: { columns: columns.map(c => c.name), rowCount: rows.length },
        schema
      });
    }

    if (response.success) {
      return this.parseAIResponse(response.content, schema);
    }

    throw new Error(response.error || 'AI analysis failed');
  }

  createDataSummary(columns, rows, schema) {
    const summary = {
      columnCount: columns.length,
      rowCount: rows.length,
      dataType: schema.dataType || detectDataType(columns, rows).type,
      columns: {},
      sampleRows: rows.slice(0, 5)
    };

    columns.forEach(col => {
      const values = rows.map(r => r[col.name]).filter(v => v !== null && v !== undefined);
      
      summary.columns[col.name] = {
        type: col.type,
        uniqueCount: new Set(values).size,
        nullCount: values.filter(v => v === null || v === undefined).length,
        sample: values.slice(0, 5)
      };

      if (col.type === 'number' || col.type === 'integer') {
        const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v));
        if (numericValues.length > 0) {
          summary.columns[col.name].min = Math.min(...numericValues);
          summary.columns[col.name].max = Math.max(...numericValues);
          summary.columns[col.name].avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        }
      }
    });

    return summary;
  }

  buildAnalysisPrompt(dataSummary) {
    return `You are a data analytics expert. Analyze this dataset and provide insights.

DATASET SUMMARY:
- Columns: ${Object.keys(dataSummary.columns).join(', ')}
- Row Count: ${dataSummary.rowCount}
- Data Type: ${dataSummary.dataType}

COLUMN DETAILS:
${Object.entries(dataSummary.columns).map(([name, info]) => `
${name}:
  Type: ${info.type}
  Unique Values: ${info.uniqueCount}
  ${info.min !== undefined ? `Range: ${info.min.toFixed(2)} - ${info.max.toFixed(2)} (Avg: ${info.avg.toFixed(2)})` : ''}
  Sample: ${info.sample.join(', ')}
`).join('\n')}

Please provide:
1. Key insights about this data
2. Recommended chart types with specific column recommendations
3. Business questions this data could answer
4. Any data quality issues to note

Respond in JSON format:
{
  "insights": ["insight1", "insight2"],
  "recommendedCharts": [{"type": "bar", "xAxis": "column", "yAxis": "column", "reason": "..."}],
  "businessQuestions": ["question1", "question2"],
  "dataQuality": ["issue1", "issue2"]
}`;
  }

  parseAIResponse(content, schema) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          insights: parsed.insights || [],
          recommendedCharts: parsed.recommendedCharts || [],
          businessQuestions: parsed.businessQuestions || [],
          dataQuality: parsed.dataQuality || []
        };
      }
    } catch (e) {
      console.warn('Failed to parse AI response as JSON');
    }

    return {
      insights: [content.substring(0, 500)],
      recommendedCharts: schema.recommendedCharts || [],
      businessQuestions: [],
      dataQuality: []
    };
  }

  async analyzeQueryContext(dataset, query) {
    const lowerQuery = query.toLowerCase();
    const schema = buildEnhancedSchema(dataset.columns, dataset.rows);
    
    let analysis = {
      intent: 'general',
      suggestedChart: null,
      metric: schema.primaryMetric,
      dimension: schema.primaryDimension,
      filters: []
    };

    if (/trend|over time|growth|increase|decrease|month|year|quarter/i.test(query)) {
      analysis.intent = 'trend';
      analysis.suggestedChart = {
        type: 'line',
        title: `${schema.primaryMetric} Trend`,
        xKey: schema.dateColumns[0] || 'date',
        yKey: schema.primaryMetric
      };
    }

    if (/compare|by category|breakdown|per|each/i.test(query)) {
      analysis.intent = 'comparison';
      analysis.suggestedChart = {
        type: 'bar',
        title: `${schema.primaryMetric} by ${schema.categoryColumns[0] || 'category'}`,
        xKey: schema.categoryColumns[0] || 'category',
        yKey: schema.primaryMetric
      };
    }

    if (/top|best|highest|lowest|worst|bottom|ranking/i.test(query)) {
      analysis.intent = 'ranking';
      analysis.suggestedChart = {
        type: 'bar',
        title: `Top ${schema.primaryMetric}`,
        xKey: schema.categoryColumns[0] || 'category',
        yKey: schema.primaryMetric
      };
    }

    if (/distribution|spread|range|average|mean/i.test(query)) {
      analysis.intent = 'distribution';
      analysis.suggestedChart = {
        type: 'histogram',
        title: `${schema.primaryMetric} Distribution`,
        xKey: 'range',
        yKey: 'count'
      };
    }

    if (/share|percentage|portion|proportion/i.test(query)) {
      analysis.intent = 'proportion';
      analysis.suggestedChart = {
        type: 'pie',
        title: `${schema.primaryMetric} Share`,
        xKey: schema.categoryColumns[0] || 'category',
        yKey: schema.primaryMetric
      };
    }

    if (/correlation|relationship|compare/i.test(query) && schema.numericColumns.length >= 2) {
      analysis.intent = 'correlation';
      analysis.suggestedChart = {
        type: 'scatter',
        title: 'Correlation Analysis',
        xKey: schema.primaryMetric,
        yKey: schema.secondaryMetric || schema.numericColumns[1]
      };
    }

    if (this.aiProvider && /why|explain|analyze|insight/i.test(query)) {
      try {
        const prompt = `Given a dataset with columns: ${dataset.columns.map(c => c.name).join(', ')}
        And the user's question: "${query}"
        
        What chart would be most appropriate and why? Respond with JSON:
        {"chartType": "bar|line|pie|scatter|area", "xAxis": "column", "yAxis": "column", "reason": "..."}`;

        let response;
        if (this.aiProvider === 'ollama') {
          response = await ollamaService.generateResponse(prompt);
        } else if (this.aiProvider === 'gemini') {
          response = await geminiService.generateResponse(prompt);
        }

        if (response.success) {
          try {
            const parsed = JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
            if (parsed.chartType) {
              analysis.suggestedChart = {
                type: parsed.chartType,
                title: `${schema.primaryMetric} Analysis`,
                xKey: parsed.xAxis,
                yKey: parsed.yAxis
              };
              analysis.aiReasoning = parsed.reason;
            }
          } catch (e) {
            console.debug('AI response parse failed, using defaults:', e.message);
          }
        }
      } catch (e) {
        console.warn('Query context analysis failed:', e.message);
      }
    }

    return analysis;
  }
}

export const aiAnalyzer = new AIAnalyzer();
export default AIAnalyzer;