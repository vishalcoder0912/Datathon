import { BaseAgent } from './base-agent.js';
import { generateWithAgent } from "../services/agentic/ollama-agent-router.js";

function parseAgentJson(result, fallback) {
  return result?.json && typeof result.json === "object" ? result.json : fallback;
}

export class DataAnalystAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.analysisTools = {
      correlation: this.analyzeCorrelation.bind(this),
      distribution: this.analyzeDistribution.bind(this),
      outliers: this.detectOutliers.bind(this),
      trend: this.analyzeTrend.bind(this),
    };
  }

  async execute(input) {
    if (input && typeof input === 'object' && input.schemaProfile) {
      this.addThought({ action: "data_analysis", reasoning: "Thinking like a real analyst to decide what matters for the dashboard." });

      const prompt = `You are DataAnalystAgent. Thinks like a real data analyst and decides what metrics, dimensions, segmentations, and correlations matter most.
Return JSON only. Do not calculate data values directly.

Format the response exactly as:
{
  "importantMeasures": [],
  "importantDimensions": [],
  "keySegments": [],
  "keyCorrelations": [],
  "analyticalReasoning": ""
}

User goal: ${input.goal || "Create the best analytics dashboard."}
Schema profile:
${JSON.stringify(input.schemaProfile, null, 2)}
RAG matches:
${JSON.stringify((input.ragMatches || []).slice(0, 3), null, 2)}`;

      const result = await generateWithAgent("dataAnalyst", prompt, { json: true });
      return parseAgentJson(result, {
        importantMeasures: input.schemaProfile.measures || [],
        importantDimensions: input.schemaProfile.dimensions || [],
        keySegments: [],
        keyCorrelations: [],
        analyticalReasoning: "Fallback data analysis result.",
      });
    }

    this.addThought({
      action: 'analyze',
      reasoning: `Analyzing data request: ${input}`,
    });

    try {
      const result = await this.processAnalysis(input);
      this.addThought({
        action: 'complete',
        reasoning: 'Analysis completed successfully',
        result,
      });
      return result;
    } catch (error) {
      this.addThought({
        action: 'error',
        reasoning: `Error during analysis: ${error.message}`,
      });
      throw error;
    }
  }

  async processAnalysis(input) {
    const request = this.parseRequest(input);
    
    switch (request.type) {
      case 'correlation':
        return this.analysisTools.correlation(request.data);
      case 'distribution':
        return this.analysisTools.distribution(request.data);
      case 'outliers':
        return this.analysisTools.outliers(request.data);
      case 'trend':
        return this.analysisTools.trend(request.data);
      default:
        return { error: 'Unknown analysis type' };
    }
  }

  parseRequest(input) {
    if (typeof input !== 'string') return { type: 'default', data: input };
    if (input.includes('correlation')) {
      return { type: 'correlation', data: input };
    }
    if (input.includes('distribution')) {
      return { type: 'distribution', data: input };
    }
    if (input.includes('outlier')) {
      return { type: 'outliers', data: input };
    }
    if (input.includes('trend')) {
      return { type: 'trend', data: input };
    }
    return { type: 'default', data: input };
  }

  analyzeCorrelation(data) {
    return {
      type: 'correlation',
      method: 'pearson',
      timestamp: Date.now(),
    };
  }

  analyzeDistribution(data) {
    return {
      type: 'distribution',
      method: 'histogram',
      timestamp: Date.now(),
    };
  }

  detectOutliers(data) {
    return {
      type: 'outliers',
      method: 'iqr',
      timestamp: Date.now(),
    };
  }

  analyzeTrend(data) {
    return {
      type: 'trend',
      method: 'linear-regression',
      timestamp: Date.now(),
    };
  }
}