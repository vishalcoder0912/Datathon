// OpenAI API provider (GPT-4)
import OpenAI from 'openai';
import { AIProviderError } from '../../../middleware/error-handler.js';

export class OpenAIProvider {
  constructor(config) {
    this.name = 'OpenAI GPT-4';
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeout = config.timeout;
    this.maxTokens = config.maxTokens;
    this.available = false;
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    if (!this.apiKey) {
      console.warn('⚠️  OpenAI API key not configured');
      this.available = false;
      this.initialized = true;
      return;
    }

    try {
      console.log('🧠 Initializing OpenAI Provider...');
      this.client = new OpenAI({
        apiKey: this.apiKey,
        timeout: this.timeout
      });
      this.available = true;
      this.initialized = true;
      console.log('✅ OpenAI initialized successfully');
    } catch (error) {
      console.error('❌ OpenAI initialization failed:', error.message);
      this.available = false;
      this.initialized = true;
      throw new AIProviderError(`OpenAI initialization failed: ${error.message}`, 'openai');
    }
  }

  async checkAvailability() {
    if (!this.apiKey) return false;

    try {
      // Test with a simple API call
      await this.client.models.list();
      this.available = true;
      return true;
    } catch (error) {
      console.warn('⚠️  OpenAI availability check failed:', error.message);
      this.available = false;
      return false;
    }
  }

  async generate(prompt, options = {}) {
    if (!this.available) {
      throw new AIProviderError('OpenAI service not available', 'openai');
    }

    try {
      console.log('🧠 OpenAI generating response...');
      const startTime = Date.now();

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: false
      });

      const text = completion.choices[0]?.message?.content || '';
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ OpenAI response received in ${duration}s`);

      return {
        success: true,
        content: text,
        model: this.model,
        duration: parseFloat(duration),
        tokens: completion.usage?.total_tokens || 0,
        provider: 'openai',
        error: null
      };
    } catch (error) {
      console.error('❌ OpenAI generation error:', error.message);
      
      // Handle specific OpenAI errors
      if (error.message.includes('API key')) {
        throw new AIProviderError('Invalid OpenAI API key', 'openai');
      } else if (error.message.includes('quota')) {
        throw new AIProviderError('OpenAI API quota exceeded', 'openai');
      } else if (error.message.includes('rate limit')) {
        throw new AIProviderError('OpenAI rate limit exceeded', 'openai');
      } else if (error.message.includes('content filter')) {
        throw new AIProviderError('Content blocked by OpenAI content filter', 'openai');
      } else {
        throw new AIProviderError(`OpenAI generation failed: ${error.message}`, 'openai');
      }
    }
  }

  async chat(messages, options = {}) {
    if (!this.available) {
      throw new AIProviderError('OpenAI service not available', 'openai');
    }

    try {
      console.log('💬 OpenAI chat with messages...');
      const startTime = Date.now();

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: false
      });

      const text = completion.choices[0]?.message?.content || '';
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ OpenAI chat response received in ${duration}s`);

      return {
        success: true,
        content: text,
        model: this.model,
        duration: parseFloat(duration),
        tokens: completion.usage?.total_tokens || 0,
        provider: 'openai',
        error: null
      };
    } catch (error) {
      console.error('❌ OpenAI chat error:', error.message);
      throw new AIProviderError(`OpenAI chat failed: ${error.message}`, 'openai');
    }
  }

  async health() {
    try {
      const isAvailable = await this.checkAvailability();
      return {
        name: this.name,
        available: isAvailable,
        model: this.model,
        apiKey: this.apiKey ? 'configured' : 'not_configured',
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
      models: [this.model, 'gpt-4-turbo', 'gpt-3.5-turbo'],
      features: ['function_calling', 'json_mode', 'system_messages'],
      limits: {
        maxTokens: this.maxTokens,
        timeout: this.timeout,
        rateLimit: '3500 requests per hour'
      }
    };
  }
}

export default OpenAIProvider;
