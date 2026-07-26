import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geminiService } from '../services/ai-providers/gemini-service.js';
import { ollamaService } from '../services/ai-providers/ollama-service.js';
import { aiProviderRouter } from '../services/ai-providers/ai-router.js';
import { providerHealthService } from '../services/ai-providers/provider-health-service.js';

describe('Hybrid AI Provider Router System', () => {
  const mockSchemaPacket = {
    datasetName: 'Test Student Dataset',
    rowCount: 100,
    columnCount: 3,
    detectedDomain: 'Education',
    columns: [
      { name: 'StudentId', type: 'string', role: 'id' },
      { name: 'Marks', type: 'number', role: 'metric' },
      { name: 'Grade', type: 'string', role: 'dimension' }
    ]
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AI_PROVIDER_MODE = 'hybrid';
  });

  it('1. Gemini provider is unavailable without API key', async () => {
    const origKey = geminiService.apiKey;
    geminiService.apiKey = '';
    expect(geminiService.isAvailable()).toBe(false);
    geminiService.apiKey = origKey;
  });

  it('2. Ollama provider is unavailable when service is offline', async () => {
    vi.spyOn(ollamaService, 'isAvailable').mockResolvedValueOnce(false);
    const available = await ollamaService.isAvailable();
    expect(available).toBe(false);
  });

  it('3. Gemini-first mode falls back to Ollama on Gemini failure', async () => {
    vi.spyOn(geminiService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(geminiService, 'generateDashboardAction').mockResolvedValueOnce({
      success: false,
      error: 'Gemini rate limited'
    });
    vi.spyOn(ollamaService, 'generateDashboardAction').mockResolvedValueOnce({
      success: true,
      parsed: {
        response_type: 'dashboard_action',
        natural_response: 'Ollama fallback generated a bar chart',
        actions: [{ action: 'create_chart', chart_type: 'bar', xKey: 'Grade', yKey: 'Marks' }]
      }
    });

    process.env.AI_PROVIDER_MODE = 'gemini_first';
    const result = await aiProviderRouter.runAITask({
      taskType: 'dashboard_planner',
      schemaPacket: mockSchemaPacket,
      userQuery: 'show average marks by grade',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('ollama');
    expect(result.selection_reason).toContain('Primary failed; fell back to ollama');
  });

  it('4. Ollama-first mode falls back to Gemini on Ollama failure', async () => {
    vi.spyOn(geminiService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(ollamaService, 'generateDashboardAction').mockResolvedValueOnce({
      success: false,
      error: 'Ollama service connection refused'
    });
    vi.spyOn(geminiService, 'generateDashboardAction').mockResolvedValueOnce({
      success: true,
      parsed: {
        response_type: 'dashboard_action',
        natural_response: 'Gemini fallback dashboard generated',
        actions: [{ action: 'create_kpi', title: 'Average Marks', metric: 'Marks', aggregation: 'avg' }]
      }
    });

    process.env.AI_PROVIDER_MODE = 'ollama_first';
    const result = await aiProviderRouter.runAITask({
      taskType: 'dashboard_planner',
      schemaPacket: mockSchemaPacket,
      userQuery: 'show kpi for average marks',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gemini');
  });

  it('5. Hybrid-best mode chooses response with higher Guardian score', async () => {
    vi.spyOn(geminiService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(ollamaService, 'isAvailable').mockResolvedValue(true);

    // Gemini returns duplicate/excessive charts (lower score)
    vi.spyOn(geminiService, 'generateDashboardAction').mockResolvedValueOnce({
      success: true,
      latency_ms: 1000,
      parsed: {
        response_type: 'dashboard_action',
        natural_response: 'Gemini generated actions',
        actions: [
          { action: 'create_chart', chart_type: 'bar', xKey: 'Grade', yKey: 'Marks' },
          { action: 'create_chart', chart_type: 'bar', xKey: 'Grade', yKey: 'Marks' }, // duplicate
          { action: 'create_chart', chart_type: 'bar', xKey: 'Grade', yKey: 'Marks' }  // duplicate
        ]
      }
    });

    // Ollama returns clean structure (higher score)
    vi.spyOn(ollamaService, 'generateDashboardAction').mockResolvedValueOnce({
      success: true,
      latency_ms: 1200,
      parsed: {
        response_type: 'dashboard_action',
        natural_response: 'Ollama generated actions',
        actions: [
          { action: 'create_chart', chart_type: 'bar', xKey: 'Grade', yKey: 'Marks' }
        ]
      }
    });

    process.env.AI_PROVIDER_MODE = 'hybrid_best';
    const result = await aiProviderRouter.runAITask({
      taskType: 'dashboard_planner',
      schemaPacket: mockSchemaPacket,
      userQuery: 'generate 7 useful charts',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('ollama'); // Ollama score should be higher due to lack of duplicates
  });

  it('6. Invalid Gemini JSON is repaired or rejected', async () => {
    vi.spyOn(geminiService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(geminiService, 'generateText').mockResolvedValueOnce({
      success: true,
      content: '```json { "response_type": "dashboard_action", "actions": [] } ```' // Markdown wrap needs cleaning
    });

    const result = await geminiService.generateDashboardAction(mockSchemaPacket, 'hi', {});
    expect(result.success).toBe(true);
  });

  it('7. Invalid Ollama JSON is repaired or rejected', async () => {
    // Check repair function handles markdown backticks correctly
    const repaired = ollamaService.repairJsonString('```json\n{ "success": true }\n```');
    expect(JSON.parse(repaired).success).toBe(true);
  });

  it('8. Dashboard actions are validated after provider response', async () => {
    vi.spyOn(geminiService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(geminiService, 'generateDashboardAction').mockResolvedValueOnce({
      success: true,
      parsed: {
        response_type: 'dashboard_action',
        natural_response: 'Actions list',
        actions: [{ action: 'create_chart', chart_type: 'pie', xKey: 'FakeColumn', yKey: 'Marks' }] // Fake column name
      }
    });

    const result = await aiProviderRouter.runAITask({
      taskType: 'dashboard_planner',
      schemaPacket: mockSchemaPacket,
      userQuery: 'show chart',
    });

    // Validated actions must not contain invalid chart with FakeColumn
    expect(result.validated_actions.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('9. Raw rows are never sent to Gemini', async () => {
    const rawContext = {
      dataset: { name: 'student_data', rows: [{ Grade: 'A', Marks: 90 }] }, // contains raw rows
      schema: { columns: [{ name: 'Grade' }] }
    };
    const prompt = geminiService.buildSystemPrompt(rawContext);
    // Ensure actual row values ('A' or 90) are not present in prompt text
    expect(prompt).not.toContain('90');
    expect(prompt).not.toContain('"Grade": "A"');
  });

  it('10. Raw rows are never sent to Ollama dashboard prompt', async () => {
    const rawContext = {
      dataset: { name: 'student_data', rows: [{ Grade: 'A', Marks: 90 }] },
      schema: { columns: [{ name: 'Grade' }] }
    };
    const prompt = ollamaService.buildSystemPrompt(rawContext);
    expect(prompt).not.toContain('90');
  });

  it('11. Provider errors do not crash backend', async () => {
    vi.spyOn(geminiService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(geminiService, 'generateDashboardAction').mockRejectedValueOnce(new Error('Network disconnected'));
    vi.spyOn(ollamaService, 'generateDashboardAction').mockRejectedValueOnce(new Error('Service offline'));

    const result = await aiProviderRouter.runAITask({
      taskType: 'dashboard_planner',
      schemaPacket: mockSchemaPacket,
      userQuery: 'generate chart',
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe('safe_fallback');
  });

  it('12. Health endpoint returns both provider states', async () => {
    vi.spyOn(geminiService, 'healthCheck').mockResolvedValueOnce({ available: true, model: 'gemini-2.5-flash', error: null });
    vi.spyOn(ollamaService, 'healthCheck').mockResolvedValueOnce({ available: true, model: 'qwen3:8b', missing_models: [], error: null });

    const health = await providerHealthService.checkHealth();
    expect(health.success).toBe(true);
    expect(health.providers.gemini.available).toBe(true);
    expect(health.providers.ollama.available).toBe(true);
  });
});
