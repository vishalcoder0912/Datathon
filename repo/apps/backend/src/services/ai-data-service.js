/**
 * AI-Powered Data Analysis Service
 * Provides intelligent data profiling, quality assessment, and recommendations
 */

import { callGeminiAI, isGeminiConfigured } from "./gemini-ai-service.js";

/**
 * Analyze uploaded data and provide AI-powered profiling
 */
export async function analyzeDatasetProfile(rows, columns) {
  const profile = {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: [],
    dataQuality: {},
    recommendations: [],
    insights: [],
    suggestedAnalyses: [],
  };

  for (const col of columns) {
    const values = rows.map(r => r[col.name]).filter(v => v !== null && v !== undefined && v !== "");
    const numericValues = values
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));
    
    const colProfile = {
      name: col.name,
      type: col.type,
      populated: values.length,
      missing: rows.length - values.length,
      missingPercent: ((rows.length - values.length) / rows.length * 100).toFixed(1),
      unique: new Set(values).size,
    };

    if (col.type === "number" && numericValues.length > 0) {
      colProfile.stats = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        median: getMedian(numericValues),
      };
    }

    profile.columns.push(colProfile);
  }

  profile.dataQuality = calculateDataQuality(rows, columns);
  profile.recommendations = generateRecommendations(profile.dataQuality, columns);
  profile.suggestedAnalyses = await generateSuggestedAnalyses(rows, columns, profile.dataQuality);

  if (isGeminiConfigured()) {
    try {
      const aiInsights = await generateAIInsights(rows, columns, profile);
      profile.insights = aiInsights;
    } catch (e) {
      console.warn("[ai-data] AI insights generation failed:", e.message);
    }
  }

  return profile;
}

function getMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateDataQuality(rows, columns) {
  const quality = {
    score: 100,
    issues: [],
    completeness: {},
    consistency: {},
  };

  for (const col of columns) {
    const values = rows.map(r => r[col.name]);
    const emptyCount = values.filter(v => v === null || v === undefined || v === "").length;
    const completeness = ((values.length - emptyCount) / values.length * 100);
    
    quality.completeness[col.name] = completeness.toFixed(1);
    
    if (completeness < 100) {
      quality.score -= (100 - completeness) * 0.1;
    }
    if (completeness < 80) {
      quality.issues.push({
        column: col.name,
        type: "missing_values",
        severity: completeness < 50 ? "high" : "medium",
        message: `${col.name} has ${(100 - completeness).toFixed(1)}% missing values`,
      });
    }

    if (col.type === "number") {
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numericValues.length > 0) {
        const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        const stdDev = Math.sqrt(numericValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numericValues.length);
        const outliers = numericValues.filter(v => Math.abs(v - mean) > 3 * stdDev);
        
        if (outliers.length > 0) {
          quality.issues.push({
            column: col.name,
            type: "outliers",
            severity: outliers.length > numericValues.length * 0.1 ? "high" : "low",
            message: `${col.name} has ${outliers.length} potential outliers`,
          });
          quality.score -= 5;
        }
      }
    }
  }

  quality.score = Math.max(0, Math.min(100, quality.score));
  return quality;
}

function generateRecommendations(quality, columns) {
  const recommendations = [];

  if (quality.score < 80) {
    recommendations.push({
      type: "data_quality",
      priority: "high",
      message: `Data quality score is ${quality.score.toFixed(0)}%. Consider cleaning before analysis.`,
    });
  }

  const missingColumns = quality.issues.filter(i => i.type === "missing_values");
  if (missingColumns.length > 0) {
    recommendations.push({
      type: "imputation",
      priority: "medium",
      message: `Consider imputing missing values in: ${missingColumns.map(i => i.column).join(", ")}`,
    });
  }

  const outlierColumns = quality.issues.filter(i => i.type === "outliers");
  if (outlierColumns.length > 0) {
    recommendations.push({
      type: "outlier_analysis",
      priority: "medium",
      message: `Review outliers in: ${outlierColumns.map(i => i.column).join(", ")}`,
    });
  }

  const numericCols = columns.filter(c => c.type === "number");
  const categoricalCols = columns.filter(c => c.type === "string");
  
  if (numericCols.length >= 2) {
    recommendations.push({
      type: "correlation_analysis",
      priority: "low",
      message: "You have multiple numeric columns - try correlation analysis to find relationships",
    });
  }

  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    recommendations.push({
      type: "segmentation",
      priority: "low",
      message: `Compare metrics across ${categoricalCols[0].name} to discover patterns`,
    });
  }

  return recommendations;
}

async function generateSuggestedAnalyses(rows, columns, quality) {
  const suggestions = [];
  const numericCols = columns.filter(c => c.type === "number");
  const categoricalCols = columns.filter(c => c.type === "string");

  for (const numCol of numericCols) {
    suggestions.push({
      type: "aggregation",
      query: `What is the total and average ${numCol.name}?`,
      priority: "high",
    });
  }

  for (const catCol of categoricalCols) {
    if (new Set(rows.map(r => r[catCol.name])).size <= 10) {
      const metricCol = numericCols[0];
      suggestions.push({
        type: "breakdown",
        query: `Show ${metricCol?.name ? metricCol.name : 'distribution'} by ${catCol.name}`,
        priority: "high",
      });
    }
  }

  // When the dataset has quality issues but no numeric columns, still offer a
  // useful starting point instead of returning an empty list.
  if (suggestions.length === 0 && quality?.issues?.length) {
    suggestions.push({
      type: "data_quality",
      query: `Show me the data quality issues for this dataset`,
      priority: "high",
    });
  }

  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      suggestions.push({
        type: "correlation",
        query: `What is the correlation between ${numericCols[i].name} and ${numericCols[j].name}?`,
        priority: "medium",
      });
    }
  }

  if (isGeminiConfigured()) {
    try {
      const aiSuggestions = await callGeminiAI(
        { name: "Dataset", columns, rowCount: rows.length },
        "Based on this dataset schema, suggest 3-5 interesting analysis questions a user might want to ask. Return only the questions, one per line."
      );
      if (aiSuggestions.success && aiSuggestions.suggestions) {
        aiSuggestions.suggestions.split("\n").forEach((q, idx) => {
          if (q.trim() && idx < 3) {
            suggestions.push({
              type: "ai_suggested",
              query: q.trim(),
              priority: "medium",
            });
          }
        });
      }
    } catch (e) {
      console.warn("[ai-data] AI suggestion generation failed:", e.message);
    }
  }

  return suggestions.filter(Boolean).slice(0, 8);
}

async function generateAIInsights(rows, columns, profile) {
  const datasetInfo = {
    name: "Dataset",
    columns: columns.map(c => ({ name: c.name, type: c.type })),
    rowCount: rows.length,
    columnCount: columns.length,
  };

  const prompt = `Analyze this dataset and provide 3-5 key insights. Focus on:
1. Interesting patterns or trends
2. Data distribution observations
3. Notable relationships between columns
4. Any anomalies or surprising values

Dataset: ${JSON.stringify(datasetInfo)}

Provide insights as a numbered list, each on a new line.`;

  try {
    const response = await callGeminiAI(datasetInfo, prompt);
    if (response.success && response.insight) {
      return response.insight.split("\n").filter(l => l.trim());
    }
  } catch (e) {
    console.warn("[ai-data] AI insight generation failed:", e.message);
  }
  return [];
}

/**
 * Detect anomalies in the dataset
 */
export async function detectAnomalies(rows, columns) {
  const anomalies = {
    statistical: [],
    pattern: [],
    dataQuality: [],
  };

  for (const col of columns) {
    if (col.type === "number") {
      const values = rows
        .map(r => parseFloat(r[col.name]))
        .filter(v => !isNaN(v));
      
      if (values.length > 10) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
        
        const outliers = values.filter(v => Math.abs(v - mean) > 3 * stdDev);
        
        if (outliers.length > 0) {
          anomalies.statistical.push({
            column: col.name,
            type: "outlier",
            count: outliers.length,
            percentage: (outliers.length / values.length * 100).toFixed(1),
            message: `${col.name} has ${outliers.length} outliers (values > 3 standard deviations from mean)`,
          });
        }
      }
    }

    if (col.type === "string") {
      const values = rows.map(r => r[col.name]);
      const emptyCount = values.filter(v => !v || v === "").length;
      if (emptyCount > values.length * 0.2) {
        anomalies.dataQuality.push({
          column: col.name,
          type: "high_missing",
          count: emptyCount,
          message: `${col.name} has ${emptyCount} missing/empty values (${(emptyCount / values.length * 100).toFixed(1)}%)`,
        });
      }
    }
  }

  if (isGeminiConfigured()) {
    try {
      const aiAnomalies = await callGeminiAI(
        { columns, rowCount: rows.length },
        "Analyze this dataset for any unusual patterns, data quality issues, or anomalies. Return 2-3 sentences describing any issues found."
      );
      if (aiAnomalies.success && aiAnomalies.insight) {
        anomalies.pattern.push({
          type: "ai_detected",
          message: aiAnomalies.insight,
        });
      }
    } catch (e) {
      console.warn("[ai-data] AI anomaly detection failed:", e.message);
    }
  }

  return anomalies;
}

/**
 * Generate narrative/story from analysis results
 */
export async function generateNarrative(datasetName, analysisResults) {
  const narrative = {
    title: `Analysis of ${datasetName}`,
    summary: "",
    sections: [],
  };

  if (analysisResults.totalRows !== undefined) {
    narrative.sections.push({
      heading: "Dataset Overview",
      content: `This dataset contains ${analysisResults.totalRows} rows and ${analysisResults.totalColumns || 'multiple'} columns.`,
    });
  }

  if (analysisResults.keyFindings) {
    narrative.sections.push({
      heading: "Key Findings",
      content: analysisResults.keyFindings,
    });
  }

  if (analysisResults.insights && analysisResults.insights.length > 0) {
    narrative.sections.push({
      heading: "Insights",
      content: analysisResults.insights.join("\n"),
    });
  }

  if (isGeminiConfigured()) {
    try {
      const aiNarrative = await callGeminiAI(
        { name: datasetName, ...analysisResults },
        `Generate a short business-friendly narrative (2-3 paragraphs) explaining the analysis results. Make it easy to understand for non-technical users.`
      );
      if (aiNarrative.success && aiNarrative.insight) {
        narrative.summary = aiNarrative.insight;
      }
    } catch (e) {
      console.warn("[ai-data] AI narrative generation failed:", e.message);
    }
  }

  return narrative;
}

/**
 * Map column relationships using AI
 */
export async function mapColumnRelationships(rows, columns) {
  const relationships = {
    correlated: [],
    categorical: [],
    temporal: [],
    inferred: [],
  };

  const numericCols = columns.filter(c => c.type === "number");
  
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const values1 = rows.map(r => parseFloat(r[numericCols[i].name])).filter(v => !isNaN(v));
      const values2 = rows.map(r => parseFloat(r[numericCols[j].name])).filter(v => !isNaN(v));
      
      const minLen = Math.min(values1.length, values2.length);
      if (minLen > 10) {
        const correlation = calculatePearsonCorrelation(
          values1.slice(0, minLen),
          values2.slice(0, minLen)
        );
        
        if (Math.abs(correlation) > 0.5) {
          relationships.correlated.push({
            columns: [numericCols[i].name, numericCols[j].name],
            strength: Math.abs(correlation),
            direction: correlation > 0 ? "positive" : "negative",
            type: Math.abs(correlation) > 0.8 ? "strong" : "moderate",
          });
        }
      }
    }
  }

  const categoricalCols = columns.filter(c => c.type === "string");
  for (const col of categoricalCols) {
    const uniqueValues = new Set(rows.map(r => r[col.name])).size;
    if (uniqueValues <= 15) {
      relationships.categorical.push({
        column: col.name,
        uniqueValues: uniqueValues,
        suggestedFor: "grouping",
      });
    }
  }

  const datePatterns = /date|month|year|day|quarter|time/i;
  for (const col of columns) {
    if (datePatterns.test(col.name)) {
      relationships.temporal.push({
        column: col.name,
        suggestedFor: "time_series",
      });
    }
  }

  if (isGeminiConfigured()) {
    try {
      const aiRelations = await callGeminiAI(
        { columns: columns.map(c => c.name), rowCount: rows.length },
        "Based on column names, suggest how these columns might relate to each other. Look for potential cause-effect, hierarchical, or transactional relationships."
      );
      if (aiRelations.success && aiRelations.intent) {
        relationships.inferred.push({
          type: "ai_suggested",
          message: aiRelations.intent,
        });
      }
    } catch (e) {
      console.warn("[ai-data] AI relationship mapping failed:", e.message);
    }
  }

  return relationships;
}

function calculatePearsonCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Generate drill-down suggestions
 */
export function generateDrillDownSuggestions(schema, currentAnalysis) {
  const suggestions = [];
  
  if (schema.dimensions && schema.dimensions.length > 1) {
    suggestions.push({
      type: "add_dimension",
      message: `Try adding "${schema.dimensions[1]}" as a secondary dimension for more detailed analysis`,
      query: `Show ${schema.metrics?.[0] || 'values'} by ${schema.dimensions[0]} and ${schema.dimensions[1]}`,
    });
  }

  if (schema.timeDimension) {
    suggestions.push({
      type: "time_analysis",
      message: "Analyze trends over time",
      query: `Show trend of ${schema.metrics?.[0] || 'values'} over ${schema.timeDimension}`,
    });
  }

  return suggestions;
}

/**
 * Suggest data cleaning operations
 */
export async function suggestDataCleaning(rows, columns) {
  const suggestions = [];

  for (const col of columns) {
    const values = rows.map(r => r[col.name]);
    const emptyCount = values.filter(v => !v || v === "").length;
    
    if (emptyCount > 0 && emptyCount < values.length * 0.3) {
      const nonEmpty = values.filter(v => v);
      const mode = getMode(nonEmpty);
      suggestions.push({
        column: col.name,
        operation: "impute_missing",
        method: "mode",
        value: mode,
        affectedRows: emptyCount,
        description: `Impute ${emptyCount} missing values with mode "${mode}"`,
      });
    }

    if (col.type === "string") {
      const trimmed = values.map(v => typeof v === "string" ? v.trim() : v);
      const hasWhitespace = values.some((v, i) => v !== trimmed[i]);
      if (hasWhitespace) {
        suggestions.push({
          column: col.name,
          operation: "trim_whitespace",
          affectedRows: values.filter((v, i) => v !== trimmed[i]).length,
          description: `Trim whitespace from ${col.name}`,
        });
      }
    }

    if (col.type === "number") {
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numericValues.length > 0 && numericValues.some(v => v < 0)) {
        const negativeCount = numericValues.filter(v => v < 0).length;
        if (negativeCount > 0) {
          suggestions.push({
            column: col.name,
            operation: "review_negatives",
            affectedRows: negativeCount,
            description: `Review ${negativeCount} negative values in ${col.name}`,
          });
        }
      }
    }
  }

  return suggestions;
}

function getMode(values) {
  const frequency = {};
  let maxFreq = 0;
  let mode = values[0];
  
  for (const value of values) {
    frequency[value] = (frequency[value] || 0) + 1;
    if (frequency[value] > maxFreq) {
      maxFreq = frequency[value];
      mode = value;
    }
  }
  
  return mode;
}
