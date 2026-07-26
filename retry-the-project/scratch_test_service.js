import { config } from 'dotenv';
config();
import { ollamaService } from './apps/backend/src/services/ai-providers/ollama-service.js';

async function testOllama() {
  console.log('Testing Ollama API Integration...');
  console.log('Model configured:', process.env.OLLAMA_MODEL || 'llama3.2:latest');

  try {
    const isAvailable = await ollamaService.isAvailable();
    console.log('Ollama is Available:', isAvailable);

    if (isAvailable) {
      console.log('Testing Connection/Version...');
      const connectionData = await ollamaService.testConnection();
      console.log('Connection Info:', connectionData);

      console.log('\nTesting generateResponse...');
      const response = await ollamaService.generateResponse('Hello, tell me a short joke about data analysis.', {
        dataset: { name: 'Test Dataset', rowCount: 100 },
        schema: { columns: [] },
        query: 'test query'
      });
      console.log('Response:', response);
    }
  } catch (err) {
    console.error('Error during test:', err.message);
  }
}

testOllama();
