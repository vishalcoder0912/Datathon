import { geminiService } from './gemini-service.js';
import { ollamaService } from './ollama-service.js';

class ProviderHealthService {
  async checkHealth() {
    const geminiHealth = await geminiService.healthCheck();
    const ollamaHealth = await ollamaService.healthCheck();

    const mode = process.env.AI_PROVIDER_MODE || 'hybrid';

    const missingOllama = ollamaHealth.missing_models || [];
    const installCommands = missingOllama.map(m => `ollama pull ${m}`);

    return {
      success: true,
      mode,
      providers: {
        gemini: {
          available: geminiHealth.available,
          models: {
            main: geminiService.mainModel,
            fast: geminiService.fastModel,
            advanced: geminiService.advancedModel,
            embedding: geminiService.embeddingModel
          },
          warning: geminiHealth.available ? null : 'Gemini API key is missing or invalid.'
        },
        ollama: {
          available: ollamaHealth.available,
          host: ollamaService.baseUrl,
          models: {
            main: ollamaService.mainModel,
            validator: ollamaService.validatorModel,
            coding: ollamaService.codingModel,
            fast: ollamaService.fastModel,
            embedding: ollamaService.embeddingModel
          },
          missing_models: missingOllama,
          install_commands: installCommands
        }
      }
    };
  }
}

export const providerHealthService = new ProviderHealthService();
export default providerHealthService;
