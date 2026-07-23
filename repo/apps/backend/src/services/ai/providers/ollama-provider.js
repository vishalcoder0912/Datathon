// Ollama provider for local LLMs (Llama 3.2 & NeuralChat 7B)
import axios from 'axios';
import { performance } from 'perf_hooks';
import { AIProviderError } from '../../../middleware/error-handler.js';

export class OllamaProvider {
  constructor(config) {
    this.name = 'Ollama';
    this.baseUrl = config.baseUrl;
    this.primaryModel = config.primaryModel;
    this.chatModel = config.chatModel;
    this.timeout = config.timeout;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
    this.topP = config.topP;
    this.frequencyPenalty = config.frequencyPenalty;
    this.available = false;
    this.models = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('🦙 Initializing Ollama Provider...');
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Primary Model: ${this.primaryModel}`);
    console.log(`   Chat Model: ${this.chatModel}`);
    
    try {
      await this.checkAvailability();
      await this.listModels();
      this.initialized = true;
      console.log('✅ Ollama Provider initialized successfully');
    } catch (error) {
      console.error('❌ Ollama initialization failed:', error.message);
      this.available = false;
      throw new AIProviderError(`Ollama initialization failed: ${error.message}`, 'ollama');
    }
  }

  async checkAvailability() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
      this.available = response.status === 200;
      console.log(`✅ Ollama is available (${response.status})`);
      return this.available;
    } catch (error) {
      console.warn(`⚠️  Ollama not available at ${this.baseUrl}:`, error.message);
      this.available = false;
      return false;
    }
  }

  async listModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
      this.models = response.data.models || [];
      console.log(`📦 Available Ollama models: ${this.models.map(m => m.name).join(', ')}`);
      return this.models;
    } catch (error) {
      console.error('Error listing Ollama models:', error.message);
      return [];
    }
  }

  getAvailableModel(preferredModel = null) {
    if (!this.available || this.models.length === 0) return null;

    if (preferredModel) {
      const found = this.models.find(m => 
        m.name.includes(preferredModel) || m.name === preferredModel
      );
      if (found) return found.name;
    }

    // Try primary model
    if (this.models.some(m => m.name.includes(this.primaryModel))) {
      return this.primaryModel;
    }

    // Try chat model
    if (this.models.some(m => m.name.includes(this.chatModel))) {
      return this.chatModel;
    }

    // Return first available model
    return this.models[0]?.name || null;
  }

  async generate(prompt, options = {}) {
    if (!this.available) {
      throw new AIProviderError('Ollama service not available', 'ollama');
    }

    const model = this.getAvailableModel(options.preferredModel);
    if (!model) {
      throw new AIProviderError('No Ollama models available', 'ollama');
    }

    try {
      console.log(`🦙 Ollama generating with model: ${model}`);
      const startTime = performance.now();

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature || this.temperature,
            top_p: options.topP || this.topP,
            num_predict: options.maxTokens || this.maxTokens,
            num_ctx: 4096,
            repeat_penalty: 1.0 - (options.frequencyPenalty || this.frequencyPenalty)
          }
        },
        {
          timeout: options.timeout || this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`✅ Ollama response received in ${duration}s`);

      return {
        success: true,
        content: response.data.response || '',
        model,
        duration: parseFloat(duration),
        tokens: response.data.eval_count || 0,
        provider: 'ollama',
        error: null
      };
    } catch (error) {
      console.error('❌ Ollama generation error:', error.message);
      throw new AIProviderError(`Ollama generation failed: ${error.message}`, 'ollama');
    }
  }

  async chat(messages, options = {}) {
    if (!this.available) {
      throw new AIProviderError('Ollama service not available', 'ollama');
    }

    const model = this.getAvailableModel(options.preferredModel || this.chatModel);
    if (!model) {
      throw new AIProviderError('No Ollama models available for chat', 'ollama');
    }

    try {
      console.log(`💬 Ollama chat with model: ${model}`);
      const startTime = performance.now();

      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature || this.temperature,
            top_p: options.topP || this.topP,
            num_predict: options.maxTokens || this.maxTokens,
            repeat_penalty: 1.0 - (options.frequencyPenalty || this.frequencyPenalty)
          }
        },
        {
          timeout: options.timeout || this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`✅ Ollama chat response received in ${duration}s`);

      return {
        success: true,
        content: response.data.message?.content || '',
        model,
        duration: parseFloat(duration),
        provider: 'ollama',
        error: null
      };
    } catch (error) {
      console.error('❌ Ollama chat error:', error.message);
      throw new AIProviderError(`Ollama chat failed: ${error.message}`, 'ollama');
    }
  }

  async pullModel(modelName) {
    try {
      console.log(`📥 Pulling model: ${modelName}`);
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        { name: modelName },
        {
          timeout: 600000, // 10 minutes for download
          headers: { 'Content-Type': 'application/json' }
        }
      );
      console.log(`✅ Model pulled: ${modelName}`);
      await this.listModels();
      return true;
    } catch (error) {
      console.error(`❌ Failed to pull model ${modelName}:`, error.message);
      throw new AIProviderError(`Failed to pull model ${modelName}: ${error.message}`, 'ollama');
    }
  }

  async health() {
    try {
      const isAvailable = await this.checkAvailability();
      return {
        name: this.name,
        available: isAvailable,
        baseUrl: this.baseUrl,
        models: this.models.map(m => m.name),
        primaryModel: this.primaryModel,
        chatModel: this.chatModel,
        initialized: this.initialized,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: this.name,
        available: false,
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  async isAvailable() {
    return this.available && this.initialized;
  }

  getCapabilities() {
    return {
      textGeneration: true,
      chat: true,
      streaming: true,
      models: this.models.map(m => m.name),
      features: ['local_inference', 'no_api_keys', 'privacy_focused'],
      limits: {
        maxTokens: this.maxTokens,
        timeout: this.timeout
      }
    };
  }
}

export default OllamaProvider;
