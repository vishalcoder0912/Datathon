// Anthropic Claude API provider
import Anthropic from '@anthropic-ai/sdk';
import { AIProviderError } from '../../../middleware/error-handler.js';

export class AnthropicProvider {
  constructor(config) {
    this.name = 'Anthropic Claude';
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeout = config.timeout;
    this.maxTokens = config.maxTokens;
    this.available = false;
    this.client = null;
    this.initialized = false;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.rpm = config.rateLimit?.rpm || 10;
    this.cooldownMs = config.rateLimit?.cooldownAfterErrorMs || 30000;
    this.minIntervalMs = Math.ceil(60000 / this.rpm);
  }

  async initialize() {
    if (this.initialized) return;

    if (!this.apiKey) {
      console.warn('⚠️  Anthropic API key not configured');
      this.available = false;
      this.initialized = true;
      return;
    }

    try {
      console.log('🧠 Initializing Anthropic Provider...');
      this.client = new Anthropic({
        apiKey: this.apiKey,
        timeout: this.timeout
      });
      this.available = true;
      this.initialized = true;
      console.log('✅ Anthropic initialized successfully');
    } catch (error) {
      console.error('❌ Anthropic initialization failed:', error.message);
      this.available = false;
      this.initialized = true;
      throw new AIProviderError(`Anthropic initialization failed: ${error.message}`, 'anthropic');
    }
  }

  async checkAvailability() {
    if (!this.apiKey) return false;

    try {
      // Test with a simple message
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      this.available = true;
      return true;
    } catch (error) {
      console.warn('⚠️  Anthropic availability check failed:', error.message);
      this.available = false;
      return false;
    }
  }

  _enforceRateLimit() {
    const now = Date.now();
    if (now - this.lastRequestTime < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - (now - this.lastRequestTime);
      throw new AIProviderError(`Rate limit: wait ${waitMs}ms between requests`, 'anthropic');
    }
    this.lastRequestTime = now;
    this.requestCount++;
  }

  async generate(prompt, options = {}) {
    if (!this.available) {
      throw new AIProviderError('Anthropic service not available', 'anthropic');
    }

    try {
      this._enforceRateLimit();
      console.log('🧠 Anthropic generating response...');
      const startTime = Date.now();

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        top_k: options.topK,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });

      const text = message.content[0]?.text || '';
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Anthropic response received in ${duration}s`);

      return {
        success: true,
        content: text,
        model: this.model,
        duration: parseFloat(duration),
        tokens: message.usage?.input_tokens + message.usage?.output_tokens || 0,
        provider: 'anthropic',
        error: null
      };
    } catch (error) {
      console.error('❌ Anthropic generation error:', error.message);
      
      // Handle specific Anthropic errors
      if (error.message.includes('API key')) {
        throw new AIProviderError('Invalid Anthropic API key', 'anthropic');
      } else if (error.message.includes('rate limit')) {
        throw new AIProviderError('Anthropic rate limit exceeded', 'anthropic');
      } else if (error.message.includes('content filter')) {
        throw new AIProviderError('Content blocked by Anthropic content filter', 'anthropic');
      } else {
        throw new AIProviderError(`Anthropic generation failed: ${error.message}`, 'anthropic');
      }
    }
  }

  async chat(messages, options = {}) {
    if (!this.available) {
      throw new AIProviderError('Anthropic service not available', 'anthropic');
    }

    try {
      this._enforceRateLimit();
      console.log('💬 Anthropic chat with messages...');
      const startTime = Date.now();

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        top_k: options.topK,
        messages: messages,
        stream: false
      });

      const text = message.content[0]?.text || '';
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Anthropic chat response received in ${duration}s`);

      return {
        success: true,
        content: text,
        model: this.model,
        duration: parseFloat(duration),
        tokens: message.usage?.input_tokens + message.usage?.output_tokens || 0,
        provider: 'anthropic',
        error: null
      };
    } catch (error) {
      console.error('❌ Anthropic chat error:', error.message);
      throw new AIProviderError(`Anthropic chat failed: ${error.message}`, 'anthropic');
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
      models: [this.model, 'claude-3-haiku-20240307'],
      features: ['large_context_window', 'reliable_output', 'safety_focused'],
      limits: {
        maxTokens: this.maxTokens,
        timeout: this.timeout,
        rateLimit: '1000 requests per hour'
      }
    };
  }
}

export default AnthropicProvider;
