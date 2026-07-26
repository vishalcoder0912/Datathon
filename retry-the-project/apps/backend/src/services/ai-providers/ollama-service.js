import axios from 'axios';
import { validateSchemaOnlyContext, extractSchemaForAI, buildSchemaOnlyPrompt } from '../../utils/schema-extractor.js';

class OllamaService {
  constructor() {
    this.baseUrl = (process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').trim();
    this.mainModel = process.env.OLLAMA_MAIN_MODEL || 'qwen3:8b';
    this.validatorModel = process.env.OLLAMA_VALIDATOR_MODEL || 'qwen3:4b';
    this.codingModel = process.env.OLLAMA_CODING_MODEL || 'qwen2.5-coder:7b';
    this.fastModel = process.env.OLLAMA_FAST_MODEL || 'llama3.2:3b';
    this.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS) || 30000;
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async generateText(prompt, options = {}) {
    try {
      const modelName = options.model || this.mainModel;
      const startTime = Date.now();

      const requestBody = {
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          num_predict: options.maxTokens || 2048,
        }
      };

      if (options.jsonMode) {
        requestBody.format = 'json';
      }

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        requestBody,
        { timeout: options.timeout || this.timeout }
      );

      const latency = Date.now() - startTime;
      let content = response.data.response || '';

      if (options.jsonMode && process.env.AI_JSON_REPAIR === 'true') {
        content = this.repairJsonString(content);
      }

      return {
        success: true,
        content: content.trim(),
        provider: 'ollama',
        model: modelName,
        latency_ms: latency
      };
    } catch (error) {
      console.error('Ollama generateText error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'ollama'
      };
    }
  }

  async generateDashboardAction(schemaPacket, userQuery, dashboardState) {
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
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.embeddingModel,
          prompt: text
        },
        { timeout: 10000 }
      );
      return response.data.embedding;
    } catch (error) {
      console.error('Ollama generateEmbedding error:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    const running = await this.isAvailable();
    if (!running) {
      return { available: false, error: 'Ollama offline' };
    }
    const installed = await this.listModels();
    const required = [this.mainModel, this.validatorModel, this.codingModel, this.fastModel, this.embeddingModel];
    const missing = required.filter(req => !installed.includes(req) && !installed.some(inst => inst.startsWith(req.split(':')[0])));

    return {
      available: true,
      model: this.mainModel,
      missing_models: missing,
      error: null
    };
  }

  async listModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      return (response.data.models || []).map(m => m.name);
    } catch {
      return [];
    }
  }

  repairJsonString(text) {
    if (!text) return '';
    let repaired = text.trim();
    // Basic repair if wrapped in markdown code blocks
    if (repaired.startsWith('```')) {
      repaired = repaired.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
    return repaired;
  }

  buildSystemPrompt(context = {}) {
    const validation = validateSchemaOnlyContext(context);
    if (!validation.isValid) {
      console.warn('Ollama service detected potential data leakage:', validation.violations);
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
      console.warn('Ollama service detected potential data leakage:', validation.violations);
    }
    return this.generateText(prompt);
  }

  async testConnection() {
    const available = await this.isAvailable();
    return {
      success: available,
      version: 'Ollama local',
      model: this.mainModel
    };
  }
}

export const ollamaService = new OllamaService();
export default ollamaService;
