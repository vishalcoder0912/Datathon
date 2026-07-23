// Google Gemini API provider
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProviderError } from '../../../middleware/error-handler.js';

export class GeminiProvider {
  constructor(config) {
    this.name = 'Google Gemini';
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
      console.warn('⚠️  Google Gemini API key not configured');
      this.available = false;
      this.initialized = true;
      return;
    }

    try {
      console.log('🤖 Initializing Google Gemini Provider...');
      this.client = new GoogleGenerativeAI(this.apiKey);
      this.available = true;
      this.initialized = true;
      console.log('✅ Google Gemini initialized successfully');
    } catch (error) {
      console.error('❌ Gemini initialization failed:', error.message);
      this.available = false;
      this.initialized = true;
      throw new AIProviderError(`Gemini initialization failed: ${error.message}`, 'gemini');
    }
  }

  async checkAvailability() {
    if (!this.apiKey) return false;

    try {
      // Test with a simple generation
      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent('Hello');
      this.available = true;
      return true;
    } catch (error) {
      console.warn('⚠️  Gemini availability check failed:', error.message);
      this.available = false;
      return false;
    }
  }

  async generate(prompt, options = {}) {
    if (!this.available) {
      throw new AIProviderError('Gemini service not available', 'gemini');
    }

    try {
      console.log('🤖 Gemini generating response...');
      const startTime = Date.now();

      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || this.maxTokens,
          topP: options.topP || 0.9,
          topK: options.topK || 40
        }
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Gemini response received in ${duration}s`);

      return {
        success: true,
        content: text,
        model: this.model,
        duration: parseFloat(duration),
        provider: 'gemini',
        error: null
      };
    } catch (error) {
      console.error('❌ Gemini generation error:', error.message);
      
      // Handle specific Gemini errors
      if (error.message.includes('API_KEY')) {
        throw new AIProviderError('Invalid Gemini API key', 'gemini');
      } else if (error.message.includes('quota')) {
        throw new AIProviderError('Gemini API quota exceeded', 'gemini');
      } else if (error.message.includes('safety')) {
        throw new AIProviderError('Content blocked by Gemini safety filters', 'gemini');
      } else {
        throw new AIProviderError(`Gemini generation failed: ${error.message}`, 'gemini');
      }
    }
  }

  async chat(messages, options = {}) {
    if (!this.available) {
      throw new AIProviderError('Gemini service not available', 'gemini');
    }

    try {
      console.log('💬 Gemini chat with messages...');
      const startTime = Date.now();

      // Convert messages to Gemini format
      const history = [];
      const lastMessage = messages[messages.length - 1];
      
      // Build conversation history (excluding last message)
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        if (msg.role === 'user') {
          history.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (msg.role === 'assistant') {
          history.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }

      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || this.maxTokens,
          topP: options.topP || 0.9,
          topK: options.topK || 40
        }
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      const text = await result.response.text();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Gemini chat response received in ${duration}s`);

      return {
        success: true,
        content: text,
        model: this.model,
        duration: parseFloat(duration),
        provider: 'gemini',
        error: null
      };
    } catch (error) {
      console.error('❌ Gemini chat error:', error.message);
      throw new AIProviderError(`Gemini chat failed: ${error.message}`, 'gemini');
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
      streaming: false,
      models: [this.model],
      features: ['multimodal', 'safety_filters', 'context_window_large'],
      limits: {
        maxTokens: this.maxTokens,
        timeout: this.timeout,
        rateLimit: '60 requests per minute'
      }
    };
  }
}

export default GeminiProvider;
