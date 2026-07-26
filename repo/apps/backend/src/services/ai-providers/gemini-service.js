import { GoogleGenerativeAI } from '@google/generative-ai';
import { validateSchemaOnlyContext, extractSchemaForAI, buildSchemaOnlyPrompt } from '../../utils/schema-extractor.js';

class GeminiService {
  constructor() {
    this.apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    this.mainModel = process.env.GEMINI_MAIN_MODEL || 'gemini-2.5-flash';
    this.fastModel = process.env.GEMINI_FAST_MODEL || 'gemini-2.5-flash-lite';
    this.advancedModel = process.env.GEMINI_ADVANCED_MODEL || 'gemini-2.5-pro';
    this.embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS) || 30000;

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  isAvailable() {
    return !!(this.apiKey && this.genAI);
  }

  async generateText(prompt, options = {}) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Gemini API key not configured',
        provider: 'gemini'
      };
    }

    try {
      const modelName = options.model || this.mainModel;
      const model = this.genAI.getGenerativeModel({ model: modelName });
      
      const generationConfig = {
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        maxOutputTokens: options.maxTokens || 4096,
      };

      if (options.jsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      const startTime = Date.now();
      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), options.timeout || this.timeout)
        )
      ]);

      const response = await result.response;
      const content = response.text();
      const latency = Date.now() - startTime;

      return {
        success: true,
        content: content?.trim() || '',
        provider: 'gemini',
        model: modelName,
        latency_ms: latency
      };
    } catch (error) {
      console.error('Gemini generateText error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'gemini'
      };
    }
  }

  async generateDashboardAction(schemaPacket, userQuery, dashboardState) {
    // Strict schema-only prompt context building
    const datasetSummary = `Dataset: ${schemaPacket.datasetName || 'dataset'}. Rows: ${schemaPacket.rowCount || 0}. Columns: ${schemaPacket.columnCount || 0}. Domain: ${schemaPacket.detectedDomain || 'unknown'}`;
    const schemaDetails = JSON.stringify(schemaPacket.columns || []);

    const prompt = `
TASK:
Generate schema-safe dashboard action JSON.

USER_QUERY:
${userQuery}

SCHEMA_PACKET:
${datasetSummary}
Columns: ${schemaDetails}

CURRENT_DASHBOARD:
${JSON.stringify(dashboardState || {})}

RULES:
* Use only columns from schema.
* Never invent values.
* Return JSON only.
* Create useful dashboard actions.
* If chart already exists, update it instead of duplicating.
* If requested column does not exist, suggest closest valid column.
* Actual values are calculated locally.

OUTPUT_FORMAT:
{
  "response_type": "dashboard_action",
  "natural_response": "",
  "actions": [],
  "warnings": [],
  "schema_safe": true
}
    `.trim();

    const response = await this.generateText(prompt, {
      model: this.mainModel,
      temperature: 0.1,
      jsonMode: true
    });

    if (!response.success) {
      return response;
    }

    try {
      const parsed = JSON.parse(response.content);
      return {
        ...response,
        parsed
      };
    } catch (error) {
      return {
        ...response,
        error: 'Invalid JSON response from model',
        parsed: null
      };
    }
  }

  validateJson(response) {
    if (!response || typeof response !== 'string') return false;
    try {
      JSON.parse(response);
      return true;
    } catch {
      return false;
    }
  }

  async generateEmbedding(text) {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }
    try {
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Gemini generateEmbedding error:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    if (!this.apiKey) {
      return { available: false, error: 'API key missing' };
    }
    try {
      const testResponse = await this.generateText('hello', { maxTokens: 5, timeout: 5000 });
      return {
        available: testResponse.success,
        model: this.mainModel,
        error: testResponse.error || null
      };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  buildSystemPrompt(context = {}) {
    const validation = validateSchemaOnlyContext(context);
    if (!validation.isValid) {
      console.warn('Gemini service detected potential data leakage:', validation.violations);
    }
    
    const { dataset, schema } = context;
    if (dataset && schema) {
      return buildSchemaOnlyPrompt('', extractSchemaForAI(dataset, schema));
    }
    return 'You are a schema-only AI analyst. You never receive raw dataset rows. You plan and explain using schema, metadata, and deterministic aggregate results only. Never ask for or rely on raw rows. You are an intelligent data analyst assistant.';
  }

  // Backward compatibility with legacy AIRouter interface
  async generateResponse(prompt, context = {}) {
    const validation = validateSchemaOnlyContext(context);
    if (!validation.isValid) {
      console.warn('Gemini service detected potential data leakage:', validation.violations);
    }
    return this.generateText(prompt);
  }

  async testConnection() {
    const health = await this.healthCheck();
    return {
      success: health.available,
      model: this.mainModel,
      error: health.error
    };
  }
}

export const geminiService = new GeminiService();
export default geminiService;
