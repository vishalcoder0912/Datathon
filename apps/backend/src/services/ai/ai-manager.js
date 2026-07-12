// Master AI orchestrator with fallback chain
import { OllamaProvider } from './providers/ollama-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { AIProviderError } from '../../middleware/error-handler.js';
import config from '../../config/environment.js';
import { assertNoRawRowsInString } from './llm-payload-sanitizer.js';

class AIManager {
  constructor() {
    this.providers = new Map();
    this.priority = config.ai.providerPriority;
    this.fallbackEnabled = config.ai.fallbackEnabled;
    this.activeProvider = null;
    this.initialized = false;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      providerUsage: {}
    };
  }

  async initialize() {
    if (this.initialized) return;

    console.log('\n🎯 ===== AI MANAGER INITIALIZATION =====');
    console.log(`Provider Priority: ${this.priority.join(' → ')}`);
    console.log(`Fallback Enabled: ${this.fallbackEnabled}`);

    // Initialize all providers
    await this.initializeProviders();

    // Set active provider based on priority
    await this.selectActiveProvider();

    this.initialized = true;
    console.log('\n✅ AI Manager initialized\n');
  }

  async initializeProviders() {
    // Initialize Ollama
    if (this.priority.includes('ollama')) {
      try {
        const ollama = new OllamaProvider(config.ollama);
        await ollama.initialize();
        this.providers.set('ollama', ollama);
        console.log('✅ Ollama provider initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Ollama:', error.message);
      }
    }

    // Initialize Gemini
    if (this.priority.includes('gemini')) {
      try {
        const gemini = new GeminiProvider(config.gemini);
        await gemini.initialize();
        this.providers.set('gemini', gemini);
        console.log('✅ Gemini provider initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Gemini:', error.message);
      }
    }

    // Initialize OpenAI
    if (this.priority.includes('openai')) {
      try {
        const openai = new OpenAIProvider(config.openai);
        await openai.initialize();
        this.providers.set('openai', openai);
        console.log('✅ OpenAI provider initialized');
      } catch (error) {
        console.error('❌ Failed to initialize OpenAI:', error.message);
      }
    }

    // Initialize Anthropic
    if (this.priority.includes('anthropic')) {
      try {
        const anthropic = new AnthropicProvider({ ...config.anthropic, rateLimit: config.rateLimit });
        await anthropic.initialize();
        this.providers.set('anthropic', anthropic);
        console.log('✅ Anthropic provider initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Anthropic:', error.message);
      }
    }
  }

  async selectActiveProvider() {
    for (const providerName of this.priority) {
      const provider = this.providers.get(providerName);
      if (provider && await provider.isAvailable()) {
        this.activeProvider = providerName;
        console.log(`\n✅ Active Provider: ${this.activeProvider.toUpperCase()}`);
        return;
      }
    }

    console.warn('\n⚠️  No AI providers available! Using rule-based analysis only.');
    this.activeProvider = null;
  }

  async generateResponse(prompt, options = {}) {
    await this.initialize();
    this.stats.totalRequests++;

    try {
      assertNoRawRowsInString(prompt);
    } catch (error) {
      this.stats.failedRequests++;
      console.error(`[AI MANAGER BLOCKED CALL] ${error.message}`);
      return {
        success: false,
        error: `Blocked unsafe LLM payload: ${error.message}`,
        provider: this.activeProvider || 'none'
      };
    }

    if (!this.activeProvider) {
      this.stats.failedRequests++;
      throw new AIProviderError('No AI providers available', 'none');
    }

    try {
      console.log(`\n📝 Generating with ${this.activeProvider}...`);
      const response = await this.executeWithProvider(this.activeProvider, 'generate', [prompt, options]);

      if (response.success) {
        this.stats.successfulRequests++;
        this.updateProviderStats(this.activeProvider);
        return response;
      }

      // Try fallback if enabled
      if (this.fallbackEnabled && !options.disableFallback) {
        console.warn(`⚠️  ${this.activeProvider} failed, trying fallback...`);
        return await this.tryFallback('generate', [prompt, options]);
      }

      this.stats.failedRequests++;
      throw new AIProviderError(response.error || 'Generation failed', this.activeProvider);

    } catch (error) {
      this.stats.failedRequests++;
      
      if (this.fallbackEnabled && !options.disableFallback && !(error instanceof AIProviderError && error.provider === 'none')) {
        return await this.tryFallback('generate', [prompt, options]);
      }

      throw error;
    }
  }

  async chat(messages, options = {}) {
    await this.initialize();
    this.stats.totalRequests++;

    try {
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          if (msg && msg.content) {
            assertNoRawRowsInString(msg.content);
          }
        }
      }
    } catch (error) {
      this.stats.failedRequests++;
      console.error(`[AI MANAGER BLOCKED CALL] ${error.message}`);
      return {
        success: false,
        error: `Blocked unsafe LLM payload: ${error.message}`,
        provider: this.activeProvider || 'none'
      };
    }

    if (!this.activeProvider) {
      this.stats.failedRequests++;
      throw new AIProviderError('No AI providers available', 'none');
    }

    try {
      console.log(`\n💬 Chatting with ${this.activeProvider}...`);
      const response = await this.executeWithProvider(this.activeProvider, 'chat', [messages, options]);

      if (response.success) {
        this.stats.successfulRequests++;
        this.updateProviderStats(this.activeProvider);
        return response;
      }

      // Try fallback if enabled
      if (this.fallbackEnabled && !options.disableFallback) {
        console.warn(`⚠️  ${this.activeProvider} failed, trying fallback...`);
        return await this.tryFallback('chat', [messages, options]);
      }

      this.stats.failedRequests++;
      throw new AIProviderError(response.error || 'Chat failed', this.activeProvider);

    } catch (error) {
      this.stats.failedRequests++;
      
      if (this.fallbackEnabled && !options.disableFallback && !(error instanceof AIProviderError && error.provider === 'none')) {
        return await this.tryFallback('chat', [messages, options]);
      }

      throw error;
    }
  }

  async executeWithProvider(providerName, method, args) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new AIProviderError(`Provider ${providerName} not found`, providerName);
    }

    try {
      return await provider[method](...args);
    } catch (error) {
      console.error(`❌ Error with ${providerName}:`, error.message);
      throw error;
    }
  }

  async tryFallback(method, args) {
    for (const providerName of this.priority) {
      if (providerName === this.activeProvider) continue;

      const provider = this.providers.get(providerName);
      if (!provider || !(await provider.isAvailable())) continue;

      try {
        console.log(`🔄 Trying ${providerName}...`);
        const response = await this.executeWithProvider(providerName, method, args);

        if (response.success) {
          console.log(`✅ Fallback to ${providerName} successful`);
          this.activeProvider = providerName;
          this.stats.successfulRequests++;
          this.updateProviderStats(providerName);
          return {
            ...response,
            usedProvider: providerName,
            fallback: true
          };
        }
      } catch (error) {
        console.warn(`⚠️  ${providerName} failed:`, error.message);
        continue;
      }
    }

    this.stats.failedRequests++;
    throw new AIProviderError('All providers failed', 'all');
  }

  async health() {
    await this.initialize();

    const health = {
      initialized: this.initialized,
      activeProvider: this.activeProvider,
      fallbackEnabled: this.fallbackEnabled,
      providers: {},
      stats: this.stats
    };

    // Get health status for each provider
    for (const [name, provider] of this.providers) {
      try {
        health.providers[name] = await provider.health();
      } catch (error) {
        health.providers[name] = {
          name,
          available: false,
          error: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    }

    return health;
  }

  async getAvailableProviders() {
    await this.initialize();
    const available = [];

    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push({
          name,
          capabilities: provider.getCapabilities()
        });
      }
    }

    return available;
  }

  async switchProvider(providerName) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new AIProviderError(`Provider ${providerName} not found`, providerName);
    }

    if (!(await provider.isAvailable())) {
      throw new AIProviderError(`Provider ${providerName} is not available`, providerName);
    }

    this.activeProvider = providerName;
    console.log(`🔄 Switched to provider: ${providerName}`);
  }

  updateProviderStats(providerName) {
    if (!this.stats.providerUsage[providerName]) {
      this.stats.providerUsage[providerName] = 0;
    }
    this.stats.providerUsage[providerName]++;
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      availableProviders: this.providers.size,
      activeProvider: this.activeProvider
    };
  }

  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      providerUsage: {}
    };
  }
}

// Create singleton instance
export const aiManager = new AIManager();

// Auto-initialize on import
setTimeout(() => {
  aiManager.initialize().catch(console.error);
}, 1000);

export default aiManager;
