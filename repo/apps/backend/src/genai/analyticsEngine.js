import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { serviceUrls } from "../config/serviceUrls.js";

const AIProvider = {
  GEMINI: "gemini",
  OLLAMA: "ollama",
  NONE: "none",
};

class AIClient {
  constructor() {
    this.genAI = null;
    this.ollamaUrl = serviceUrls.ollama;
    this.ollamaModel = "llama3.2";
    this.ollamaAvailable = false;
    this.activeProvider = AIProvider.NONE;
    this.fallbackChain = [];
    this.initializeProviders();
  }

  initializeProviders() {
    const googleKey = process.env.GOOGLE_API_KEY || "";
    this.fallbackChain = [];
    this.ollamaUrl = serviceUrls.ollama;
    this.ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";

    this.testOllamaConnection().then(() => {
      if (this.ollamaAvailable && !this.fallbackChain.includes(AIProvider.OLLAMA)) {
        this.fallbackChain.unshift(AIProvider.OLLAMA);
        this.activeProvider = AIProvider.OLLAMA;
        console.log("🔄 Primary AI Provider: OLLAMA (Local)");
      }
    }).catch(() => {});

    if (googleKey) {
      try {
        this.genAI = new GoogleGenerativeAI(googleKey);
        this.fallbackChain.push(AIProvider.GEMINI);
        console.log("✅ Google Gemini AI initialized (Fallback)");
      } catch (e) {
        console.warn("⚠️ Failed to initialize Gemini:", e);
      }
    } else {
      console.warn("⚠️ GOOGLE_API_KEY not found - Using Local AI only");
    }

    if (this.fallbackChain.length === 0) {
      console.error("❌ No AI provider available! Please start Ollama or set GOOGLE_API_KEY.");
    } else if (this.activeProvider === AIProvider.NONE && this.fallbackChain.length > 0) {
      this.activeProvider = this.fallbackChain[0];
      console.log(`🔄 Primary AI Provider: ${this.activeProvider}`);
    }
  }

  async generateContent(prompt, systemPrompt) {
    let lastError = null;

    for (let i = 0; i < this.fallbackChain.length; i++) {
      const provider = this.fallbackChain[i];

      try {
        let result;

        switch (provider) {
          case AIProvider.GEMINI:
            result = await this.generateWithGemini(prompt);
            break;
          case AIProvider.OLLAMA:
            result = await this.generateWithOllama(prompt, systemPrompt);
            break;
          default:
            continue;
        }

        this.activeProvider = provider;
        return result;
      } catch (e) {
        console.warn(`⚠️ ${provider} failed: ${e.message}`);
        lastError = e;
        this.activeProvider = this.fallbackChain[i + 1] || AIProvider.NONE;
      }
    }

    throw new Error(
      `All AI providers failed. Last error: ${lastError?.message || "Unknown error"}`
    );
  }

  async generateWithGemini(prompt) {
    if (!this.genAI) throw new Error("Gemini not initialized");
    const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async generateWithOllama(prompt, systemPrompt) {
    if (!this.ollamaUrl) throw new Error("Ollama not initialized");

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
      model: this.ollamaModel,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 4000,
      },
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data.message?.content || "";
  }

  getActiveProvider() {
    return this.activeProvider;
  }

  isAvailable() {
    return this.activeProvider !== AIProvider.NONE;
  }

  async testOllamaConnection() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      if (response.status === 200) {
        this.ollamaAvailable = true;
        console.log(`✅ Ollama initialized with model: ${this.ollamaModel}`);
      }
    } catch (e) {
      this.ollamaAvailable = false;
      console.warn(`⚠️ Ollama not available at ${this.ollamaUrl} - Using Gemini only`);
    }
  }
}

let aiClient;

function getAIClient() {
  if (!aiClient) {
    aiClient = new AIClient();
  }
  return aiClient;
}

export class AnalyticsEngine {
  constructor() {
    this.model = getAIClient();
  }

  async analyzeDatasetStructure(dataset) {
    if (!this.model.isAvailable()) {
      return this.getFallbackSchema(dataset);
    }

    try {
      const dataPreview = JSON.stringify((dataset.data || dataset.rows || []).slice(0, 5), null, 2);
      const columns = Array.isArray(dataset.columns) ? dataset.columns : [];
      const data = Array.isArray(dataset.data) ? dataset.data : (Array.isArray(dataset.rows) ? dataset.rows : []);
      const columnInfo = columns.map((col) => {
        const colName = typeof col === "string" ? col : col?.name;
        return {
          name: colName || "",
          sample_values: data.slice(0, 3).map((row) => row?.[colName]),
        };
      });

      const prompt = `
Analyze this dataset and generate a semantic schema for analytics:

Columns: ${JSON.stringify(columnInfo)}
Data Preview: ${dataPreview}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "dataset_domain": "business domain",
  "fact_entity": "main fact table entity",
  "dimensions": ["list of dimension columns"],
  "measures": ["list of numeric measure columns"],
  "geo_dimensions": ["geographic columns if any"],
  "time_columns": ["time-based columns if any"],
  "recommended_kpis": [
    {
      "name": "KPI name",
      "description": "business meaning",
      "formula": "how to calculate",
      "business_value": "why it matters"
    }
  ],
  "recommended_visualizations": [
    {
      "type": "chart type",
      "title": "chart title",
      "dimensions": ["dimension1"],
      "measures": ["measure1"],
      "insight": "what this shows"
    }
  ]
}`;

      const response = await this.model.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getFallbackSchema(dataset);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn("AI analyzeDatasetStructure failed, using fallback schema:", error.message);
      return this.getFallbackSchema(dataset);
    }
  }

  async generateKPIs(schema, dataset) {
    if (!this.model.isAvailable()) {
      return this.getFallbackKPIs(dataset);
    }

    const dataStats = this.calculateDataStatistics(dataset);

    const prompt = `
Given this analytics schema and dataset statistics, generate ONLY high-value business KPIs:

Schema Domain: ${schema.dataset_domain}
Measures: ${schema.measures.join(", ")}
Dimensions: ${schema.dimensions.join(", ")}
Statistics: ${JSON.stringify(dataStats)}

Generate 8-12 meaningful KPIs that represent real business value.
Never include generic metrics like "Row Count" or "Total Records".

Respond with ONLY valid JSON array (no markdown, no explanation):
[
  {
    "name": "KPI name",
    "description": "what it measures",
    "formula": "how to calculate it",
    "business_value": "why it matters for decision making"
  }
]`;

    const response = await this.model.generateContent(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return this.getFallbackKPIs(dataset);

    return JSON.parse(jsonMatch[0]);
  }

  async generateVisualizations(schema, dataset) {
    if (!this.model.isAvailable()) {
      return this.getFallbackVisualizations(schema);
    }

    try {
      const correlationAnalysis = this.analyzeCorrelations(dataset, schema);

      const prompt = `
Generate 15-18 professional data visualizations for an enterprise analytics dashboard.

Dataset Domain: ${schema.dataset_domain}
Dimensions: ${schema.dimensions.join(", ")}
Measures: ${schema.measures.join(", ")}
Correlations: ${JSON.stringify(correlationAnalysis)}

Rules:
- Never duplicate chart types or dimensions
- Each chart must have clear business purpose
- Use appropriate chart types for data relationships
- Include trend, comparison, composition, and correlation visualizations
- Generate actionable insights for each chart

Respond with ONLY valid JSON array (no markdown):
[
  {
    "type": "chart type (bar/line/scatter/heatmap/etc)",
    "title": "descriptive title",
    "dimensions": ["dimension names"],
    "measures": ["measure names"],
    "aggregation": "SUM/AVG/COUNT/etc",
    "insight": "business insight this chart reveals"
  }
]`;

      const response = await this.model.generateContent(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return this.getFallbackVisualizations(schema);

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn("AI generateVisualizations failed, using fallback visualizations:", error.message);
      return this.getFallbackVisualizations(schema);
    }
  }

  async buildExecutiveDashboard(schema, kpis, visualizations) {
    const fallbackVal = {
      title: "Executive Dashboard",
      domain: schema.dataset_domain,
      kpis: kpis.slice(0, 8),
      charts: visualizations.slice(0, 12),
      insights: [],
      layout: { sections: ["Executive Overview", "Analytics"] },
      filters: [],
      recommendations: [],
    };

    if (!this.model.isAvailable()) {
      return fallbackVal;
    }

    try {
      const prompt = `
Create an executive-grade analytics dashboard structure:

Domain: ${schema.dataset_domain}
KPIs: ${JSON.stringify(kpis.slice(0, 8))}
Charts: ${JSON.stringify(visualizations.slice(0, 6))}

Dashboard should include:
- Executive summary section
- 6-8 top KPI cards
- 10-12 strategic visualizations
- Trend analysis
- Comparative analytics
- Anomaly alerts
- Business recommendations

Respond with ONLY valid JSON (no markdown):
{
  "title": "dashboard title",
  "domain": "business domain",
  "layout": {
    "sections": ["Executive Overview", "KPI Summary", "Trend Analytics", "Comparative Analytics"]
  },
  "filters": [{"name": "filter", "type": "type", "dimension": "dimension"}],
  "insights": ["key insight 1", "key insight 2"],
  "recommendations": ["action recommendation 1"]
}`;

      const response = await this.model.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return fallbackVal;
      }

      const dashboardConfig = JSON.parse(jsonMatch[0]);
      return {
        title: dashboardConfig.title || "Executive Dashboard",
        domain: schema.dataset_domain,
        kpis: kpis.slice(0, 8),
        charts: visualizations.slice(0, 12),
        insights: dashboardConfig.insights || [],
        layout: dashboardConfig.layout || {},
        filters: dashboardConfig.filters || [],
        recommendations: dashboardConfig.recommendations || [],
      };
    } catch (error) {
      console.warn("AI buildExecutiveDashboard failed, using fallback dashboard config:", error.message);
      return fallbackVal;
    }
  }

  async generateAIInsights(schema, dataset) {
    if (!this.model.isAvailable()) {
      return this.getFallbackInsights(dataset);
    }

    try {
      const statistics = this.calculateDataStatistics(dataset);
      const outliers = this.detectOutliers(dataset, schema);

      const prompt = `
Generate 8-10 executive-level insights from this dataset:

Domain: ${schema.dataset_domain}
Statistics: ${JSON.stringify(statistics)}
Outliers: ${JSON.stringify(outliers)}

Each insight should:
- Be data-driven and specific
- Have business impact
- Be actionable
- Use concrete numbers/percentages

Respond with ONLY valid JSON array:
[
  {
    "type": "trend/anomaly/correlation/opportunity",
    "insight": "the insight statement",
    "data_points": {"key": "value"},
    "business_impact": "why this matters"
  }
]`;

      const response = await this.model.generateContent(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return this.getFallbackInsights(dataset);

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn("AI generateAIInsights failed, using fallback insights:", error.message);
      return this.getFallbackInsights(dataset);
    }
  }

  async respondToAnalyticsQuery(query, schema, dataset) {
    const dataStats = this.calculateDataStatistics(dataset);

    if (!this.model.isAvailable()) {
      return {
        response: "AI service unavailable. Please configure an API key (GOOGLE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).",
        charts: [],
      };
    }

    try {
      const prompt = `
You are an enterprise analytics assistant. Answer this analytics query about the dataset:

Query: "${query}"
Domain: ${schema.dataset_domain}
Available Dimensions: ${schema.dimensions.join(", ")}
Available Measures: ${schema.measures.join(", ")}
Dataset Stats: ${JSON.stringify(dataStats)}

Provide:
1. Direct answer to the query
2. Relevant insights
3. Recommended visualizations if applicable

Respond in JSON format:
{
  "response": "your analysis and answer",
  "recommended_charts": [{"type": "...", "title": "...", "insight": "..."}],
  "key_metrics": {"metric_name": "value"}
}`;

      const response = await this.model.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          response: response,
          charts: [],
        };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn("AI respondToAnalyticsQuery failed:", error.message);
      return {
        response: `AI query failed: ${error.message}. Standard fallback analysis was processed.`,
        charts: [],
      };
    }
  }

  getFallbackSchema(dataset) {
    const columns = Array.isArray(dataset?.columns) ? dataset.columns : [];
    const data = Array.isArray(dataset?.data) ? dataset.data : (Array.isArray(dataset?.rows) ? dataset.rows : []);

    const numericCols = columns.filter((col) => {
      const colName = typeof col === "string" ? col : col?.name;
      return colName && data.some((row) => typeof row?.[colName] === "number");
    });
    const stringCols = columns.filter(
      (col) => !numericCols.includes(col)
    );
    const geoCols = stringCols.filter((col) => {
      const colName = typeof col === "string" ? col : col?.name;
      return colName && /country|state|city|region|location|address|market|territory|latitude|longitude/i.test(colName);
    });

    return {
      dataset_domain: "Analytics Dataset",
      fact_entity: "Records",
      dimensions: stringCols.map(c => typeof c === "string" ? c : c?.name).filter(Boolean).slice(0, 5),
      measures: numericCols.map(c => typeof c === "string" ? c : c?.name).filter(Boolean).slice(0, 5),
      geo_dimensions: geoCols.map(c => typeof c === "string" ? c : c?.name).filter(Boolean),
      time_columns: columns
        .map(c => typeof c === "string" ? c : c?.name)
        .filter(Boolean)
        .filter((c) => c.toLowerCase().includes("date") || c.toLowerCase().includes("time")),
      recommended_kpis: [],
      recommended_visualizations: [],
    };
  }

  getFallbackKPIs(dataset) {
    const stats = this.calculateDataStatistics(dataset);
    const kpis = [];

    for (const key of Object.keys(stats)) {
      if (key.endsWith("_avg")) {
        const col = key.replace("_avg", "");
        kpis.push({
          name: `Average ${col}`,
          description: `Mean value of ${col}`,
          formula: `AVG(${col})`,
          business_value: "Basic statistical measure",
        });
      }
      if (kpis.length >= 8) break;
    }

    if (kpis.length === 0) {
      return [
        { name: "Total Records", description: "Total number of records", business_value: "Data volume metric" },
        { name: "Unique Values", description: "Count of unique entries", business_value: "Data diversity metric" },
      ];
    }

    return kpis;
  }

  getFallbackVisualizations(schema) {
    const viz = [];

    for (const measure of schema.measures.slice(0, 4)) {
      viz.push({
        type: "bar",
        title: `${measure} Distribution`,
        dimensions: schema.dimensions.slice(0, 2),
        measures: [measure],
        insight: "Shows distribution across categories",
      });
    }

    if (schema.time_columns.length > 0) {
      viz.push({
        type: "line",
        title: "Trend Over Time",
        dimensions: schema.time_columns,
        measures: schema.measures.slice(0, 2),
        insight: "Shows temporal trends",
      });
    }

    return viz.length > 0 ? viz : [
      { type: "table", title: "Data Overview", dimensions: schema.dimensions.slice(0, 3), measures: schema.measures.slice(0, 2), insight: "Raw data view" }
    ];
  }

  getFallbackInsights(dataset) {
    const stats = this.calculateDataStatistics(dataset);
    const insights = [];

    for (const [key, value] of Object.entries(stats)) {
      if (key.endsWith("_avg") && typeof value === "number") {
        insights.push({
          type: "trend",
          insight: `Average ${key.replace("_avg", "")} is ${value.toFixed(2)}`,
          data_points: { [key]: value },
          business_value: "Statistical summary",
          business_impact: "Provides baseline metrics for analysis",
        });
      }
      if (insights.length >= 5) break;
    }

    return insights.length > 0 ? insights : [
      { type: "opportunity", insight: "Configure AI API keys for intelligent insights", data_points: {}, business_impact: "Enhanced analytics" }
    ];
  }

  calculateDataStatistics(dataset) {
    const stats = {};
    const columns = Array.isArray(dataset?.columns) ? dataset.columns : [];
    const data = Array.isArray(dataset?.data) ? dataset.data : (Array.isArray(dataset?.rows) ? dataset.rows : []);

    for (const col of columns) {
      const colName = typeof col === "string" ? col : col?.name;
      if (!colName) continue;
      const values = data.map((row) => row[colName]);
      const numericValues = values
        .filter((v) => typeof v === "number")
        .sort((a, b) => a - b);

      if (numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        stats[`${colName}_avg`] = sum / numericValues.length;
        stats[`${colName}_min`] = numericValues[0];
        stats[`${colName}_max`] = numericValues[numericValues.length - 1];
        stats[`${colName}_count`] = numericValues.length;
      } else {
        const uniqueCount = new Set(values).size;
        stats[`${colName}_unique`] = uniqueCount;
      }
    }

    return stats;
  }

  analyzeCorrelations(dataset, schema) {
    const correlations = {};
    const measures = schema.measures;

    if (measures.length >= 2) {
      for (let i = 0; i < measures.length; i++) {
        for (let j = i + 1; j < measures.length; j++) {
          const measure1 = measures[i];
          const measure2 = measures[j];
          const values1 = dataset.data.map((row) => row[measure1]);
          const values2 = dataset.data.map((row) => row[measure2]);

          const correlation = this.calculatePearsonCorrelation(values1, values2);
          if (!isNaN(correlation)) {
            correlations[`${measure1}_vs_${measure2}`] = Math.round(correlation * 100) / 100;
          }
        }
      }
    }

    return correlations;
  }

  calculatePearsonCorrelation(x, y) {
    if (x.length !== y.length) return 0;

    const n = x.length;
    const mean_x = x.reduce((a, b) => a + b, 0) / n;
    const mean_y = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator_x = 0;
    let denominator_y = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - mean_x;
      const dy = y[i] - mean_y;
      numerator += dx * dy;
      denominator_x += dx * dx;
      denominator_y += dy * dy;
    }

    const denominator = Math.sqrt(denominator_x * denominator_y);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  detectOutliers(dataset, schema) {
    const outliers = [];

    for (const measure of schema.measures) {
      const values = dataset.data
        .map((row) => row[measure])
        .filter((v) => typeof v === "number");

      if (values.length < 4) continue;

      values.sort((a, b) => a - b);
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      dataset.data.forEach((row) => {
        const value = row[measure];
        if (value < lowerBound || value > upperBound) {
          outliers.push({
            measure,
            value,
            type: value < lowerBound ? "low" : "high",
          });
        }
      });
    }

    return outliers;
  }
}

export default AnalyticsEngine;
