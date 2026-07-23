// AI Response Parser Utilities

/**
 * Parse JSON from AI response, handling various formats
 */
export function parseJSONFromResponse(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  // Try direct JSON parse first
  try {
    return JSON.parse(response);
  } catch (e) {
    // Continue to other methods
  }

  // Try extracting JSON from markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      // Continue
    }
  }

  // Try finding JSON object in response
  const objectMatch = response.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (e) {
      // Continue
    }
  }

  // Try finding JSON array in response
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (e) {
      // Continue
    }
  }

  console.warn('Failed to parse JSON from response');
  return null;
}

/**
 * Extract structured data from AI response
 */
export function extractStructuredData(response, schema = {}) {
  const parsed = parseJSONFromResponse(response);
  
  if (!parsed) {
    return {
      success: false,
      data: null,
      raw: response
    };
  }

  // Validate against schema if provided
  if (Object.keys(schema).length > 0) {
    const validated = validateAgainstSchema(parsed, schema);
    return {
      success: true,
      data: validated,
      raw: response
    };
  }

  return {
    success: true,
    data: parsed,
    raw: response
  };
}

/**
 * Validate parsed data against schema
 */
function validateAgainstSchema(data, schema) {
  const result = {};
  
  for (const [key, type] of Object.entries(schema)) {
    if (data[key] !== undefined) {
      // Type checking
      if (type === 'number' && typeof data[key] === 'number') {
        result[key] = data[key];
      } else if (type === 'string' && typeof data[key] === 'string') {
        result[key] = data[key];
      } else if (type === 'boolean' && typeof data[key] === 'boolean') {
        result[key] = data[key];
      } else if (type === 'array' && Array.isArray(data[key])) {
        result[key] = data[key];
      } else if (type === 'object' && typeof data[key] === 'object') {
        result[key] = data[key];
      } else {
        console.warn(`Type mismatch for ${key}: expected ${type}, got ${typeof data[key]}`);
        result[key] = data[key]; // Keep it anyway
      }
    }
  }
  
  return result;
}

/**
 * Parse analysis results from AI response
 */
export function parseAnalysisResponse(response) {
  const parsed = parseJSONFromResponse(response);
  
  if (!parsed) {
    return {
      success: false,
      summary: response,
      insights: [],
      recommendations: [],
      raw: response
    };
  }

  return {
    success: true,
    summary: parsed.summary || parsed.overview || '',
    insights: parsed.insights || parsed.findings || [],
    recommendations: parsed.recommendations || parsed.suggestions || [],
    statistics: parsed.statistics || {},
    visualizations: parsed.visualizations || parsed.charts || [],
    raw: response
  };
}

/**
 * Parse correlation results
 */
export function parseCorrelationResponse(response) {
  const parsed = parseJSONFromResponse(response);
  
  if (!parsed) {
    return {
      success: false,
      correlations: [],
      raw: response
    };
  }

  // Normalize correlation data
  const correlations = (parsed.correlations || []).map(corr => ({
    variable1: corr.variable1 || corr.x || corr[0],
    variable2: corr.variable2 || corr.y || corr[1],
    coefficient: parseFloat(corr.coefficient || corr.r || corr.correlation || corr[2]),
    strength: getCorrelationStrength(Math.abs(corr.coefficient || corr.r || corr.correlation || corr[2])),
    type: (corr.coefficient || corr.r || corr.correlation || 0) >= 0 ? 'positive' : 'negative'
  }));

  return {
    success: true,
    correlations,
    patterns: parsed.patterns || [],
    anomalies: parsed.anomalies || [],
    raw: response
  };
}

/**
 * Get correlation strength description
 */
function getCorrelationStrength(value) {
  if (value >= 0.7) return 'strong';
  if (value >= 0.4) return 'moderate';
  if (value >= 0.2) return 'weak';
  return 'very weak';
}

/**
 * Parse visualization recommendations
 */
export function parseVisualizationResponse(response) {
  const parsed = parseJSONFromResponse(response);
  
  if (!parsed) {
    return {
      success: false,
      charts: [],
      raw: response
    };
  }

  const charts = (parsed.recommended_charts || parsed.charts || parsed.visualizations || []).map(chart => ({
    type: chart.type || chart.chartType,
    title: chart.title || chart.name,
    xAxis: chart.xAxis || chart.x,
    yAxis: chart.yAxis || chart.y,
    reasoning: chart.reasoning || chart.description || '',
    config: chart.config || chart.options || {}
  }));

  return {
    success: true,
    charts,
    reasoning: parsed.reasoning || '',
    raw: response
  };
}

/**
 * Parse chat response
 */
export function parseChatResponse(response) {
  // For chat, we usually want the raw text
  // But try to extract structured data if present
  
  const parsed = parseJSONFromResponse(response);
  
  if (parsed && parsed.response) {
    return {
      success: true,
      message: parsed.response,
      data: parsed,
      raw: response
    };
  }

  return {
    success: true,
    message: response,
    data: null,
    raw: response
  };
}

/**
 * Clean and normalize AI response text
 */
export function cleanResponseText(text) {
  if (!text) return '';
  
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
    .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
    .trim();
}

/**
 * Extract key-value pairs from response
 */
export function extractKeyValuePairs(response) {
  const pairs = {};
  
  // Match patterns like "key: value" or "key = value"
  const regex = /([a-zA-Z_][a-zA-Z0-9_\s]*?)[:=]\s*(.+?)(?:\n|$)/g;
  let match;
  
  while ((match = regex.exec(response)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    pairs[key] = value;
  }
  
  return pairs;
}

export default {
  parseJSONFromResponse,
  extractStructuredData,
  parseAnalysisResponse,
  parseCorrelationResponse,
  parseVisualizationResponse,
  parseChatResponse,
  cleanResponseText,
  extractKeyValuePairs
};
