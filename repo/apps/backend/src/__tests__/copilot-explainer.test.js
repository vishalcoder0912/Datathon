import { describe, expect, it, vi } from 'vitest';
import {
  COPILOT_OLLAMA_FALLBACK_MESSAGE,
  buildAuthorizedCopilotContext,
  explainAuthorizedCopilotResult,
  isLocalOllamaUrl,
} from '../kavach/services/copilot-explainer.js';

describe('KAVACH Copilot local Ollama explainer', () => {
  it('sends only a redacted authorized result to a local Ollama chat endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ message: { content: 'The authorized result reports 12 incidents. Human verification is required.' } }),
    }));

    const result = await explainAuthorizedCopilotResult({
      question: 'Summarize the approved result',
      authoritativeResult: {
        toolUsed: 'getOverview',
        message: 'Total incidents: 12.',
        recordCount: 12,
        data: {
          totalIncidents: 12,
          fullName: 'Synthetic Person',
          mobileHash: 'secret-hash',
          briefFacts: 'Sensitive source detail',
          sqlQuery: 'SELECT * FROM case_master',
        },
      },
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:4b',
      fetchImpl,
      enabled: true,
    });

    expect(result.used).toBe(true);
    expect(result.text).toContain('12 incidents');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const prompt = requestBody.messages.map((message) => message.content).join('\n');
    expect(requestBody.model).toBe('qwen3:4b');
    expect(prompt).toContain('presentation-only layer');
    expect(prompt).not.toContain('Synthetic Person');
    expect(prompt).not.toContain('secret-hash');
    expect(prompt).not.toContain('Sensitive source detail');
    expect(prompt).not.toContain('SELECT * FROM case_master');
  });

  it('returns the deterministic fallback when local Ollama is unavailable', async () => {
    const result = await explainAuthorizedCopilotResult({
      question: 'Show overview',
      authoritativeResult: { toolUsed: 'getOverview', data: { totalIncidents: 3 } },
      fetchImpl: vi.fn(async () => { throw new Error('offline'); }),
      enabled: true,
    });

    expect(result.used).toBe(false);
    expect(result.fallbackMessage).toBe(COPILOT_OLLAMA_FALLBACK_MESSAGE);
  });

  it('rejects model output that contains SQL instead of an explanation', async () => {
    const result = await explainAuthorizedCopilotResult({
      question: 'Show overview',
      authoritativeResult: { toolUsed: 'getOverview', data: { totalIncidents: 3 } },
      fetchImpl: vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: 'SELECT * FROM case_master;' } }) })),
      enabled: true,
    });

    expect(result.used).toBe(false);
    expect(result.reason).toBe('invalid_response');
  });

  it('permits local endpoints and rejects remote endpoints', () => {
    expect(isLocalOllamaUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalOllamaUrl('https://example.com')).toBe(false);
  });

  it('keeps the serialized context bounded when the authorized result is large', () => {
    const context = buildAuthorizedCopilotContext('overview', { data: Array.from({ length: 100 }, () => ({ total: 1, detail: 'x'.repeat(1_000) })) });
    expect(context.serialized.length).toBeLessThanOrEqual(12_000);
  });
});
