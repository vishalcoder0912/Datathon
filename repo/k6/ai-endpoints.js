import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, thresholds, rampUpStages } from './options.js';

const aiChatTrend = new Trend('ai_chat_time');
const aiHealthTrend = new Trend('ai_health_time');
const aiFallbackTrend = new Trend('ai_fallback_time');
const aiErrorRate = new Rate('ai_errors');

const VUS = parseInt(__ENV.VU) || 100;

export let options = {
  stages: rampUpStages(VUS, '1m', '3m', '1m'),
  thresholds: {
    ...thresholds,
    ai_chat_time: ['p(95)<5000', 'p(99)<10000'],
    ai_health_time: ['p(95)<500'],
    ai_fallback_time: ['p(95)<3000'],
    ai_errors: ['rate<0.05'],
  },
};

export default function () {
  group('AI Provider Health', function () {
    const endpoints = [
      `${BASE_URL}/api/ai/providers/health`,
      `${BASE_URL}/api/ai/ollama/health`,
      `${BASE_URL}/api/ai/status`,
    ];

    for (const url of endpoints) {
      const res = http.get(url, { tags: { endpoint: 'ai-health' } });
      aiHealthTrend.add(res.timings.duration);
      aiErrorRate.add(res.status >= 400);

      check(res, {
        [`ai health ${url.split('/').pop()} ok`]: (r) => r.status === 200,
        [`ai health fast < 500ms`]: (r) => r.timings.duration < 500,
      });

      sleep(0.2);
    }
  });

  group('AI Chat Commands', function () {
    const commands = [
      { type: 'chart', query: 'Create a bar chart of values by category' },
      { type: 'kpi', query: 'Show me the average value' },
      { type: 'analysis', query: 'Analyze the trend in this data' },
      { type: 'dashboard', query: 'Generate a full dashboard' },
    ];

    for (const cmd of commands) {
      const payload = JSON.stringify({
        message: cmd.query,
        command: cmd.type,
        datasetId: `test-${__VU}`,
      });

      const res = http.post(`${BASE_URL}/api/ai/chat`, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'ai-chat', command: cmd.type },
      });

      aiChatTrend.add(res.timings.duration);
      aiErrorRate.add(res.status >= 400);

      check(res, {
        [`ai chat ${cmd.type} ok`]: (r) => r.status < 500,
      });

      sleep(0.5);
    }
  });

  group('AI Fallback Behavior', function () {
    const payload = JSON.stringify({
      message: 'Analyze this dataset',
      preferProvider: 'ollama',
      datasetId: `test-fallback-${__VU}`,
    });

    const res = http.post(`${BASE_URL}/api/ai/chat`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'ai-fallback' },
    });

    aiFallbackTrend.add(res.timings.duration);
    aiErrorRate.add(res.status >= 400);

    check(res, {
      'fallback response ok': (r) => r.status < 500,
    });

    sleep(0.5);
  });

  group('AI Agent Commands', function () {
    const agentPayload = JSON.stringify({
      command: 'analyze',
      datasetId: `test-agent-${__VU}`,
    });

    const res = http.post(`${BASE_URL}/api/agentic/analyze`, agentPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'agentic-analyze' },
    });

    check(res, {
      'agentic analyze ok': (r) => r.status < 500,
    });

    sleep(0.3);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/k6-ai-endpoints.json': JSON.stringify({
      summary: {
        chat: {
          avg: data.metrics.ai_chat_time?.values?.avg || 0,
          p95: data.metrics.ai_chat_time?.values?.['p(95)'] || 0,
          p99: data.metrics.ai_chat_time?.values?.['p(99)'] || 0,
        },
        health: {
          avg: data.metrics.ai_health_time?.values?.avg || 0,
          p95: data.metrics.ai_health_time?.values?.['p(95)'] || 0,
        },
        fallback: {
          avg: data.metrics.ai_fallback_time?.values?.avg || 0,
          p95: data.metrics.ai_fallback_time?.values?.['p(95)'] || 0,
        },
        error_rate: data.metrics.ai_errors?.values?.rate || 0,
        passed: (data.metrics.ai_errors?.values?.rate || 1) < 0.05,
      },
    }),
  };
}
