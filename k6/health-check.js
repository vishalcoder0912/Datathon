import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, thresholds, smokeTestStages, stressTestStages } from './options.js';

const healthTrend = new Trend('health_response_time');
const healthFailRate = new Rate('health_errors');

export let options = {
  thresholds: {
    ...thresholds,
    health_response_time: ['p(95)<200'],
    health_errors: ['rate<0.01'],
  },
};

export default function () {
  group('Health Check Endpoints', function () {
    const endpoints = [
      { name: 'ping', url: `${BASE_URL}/api/health/ping` },
      { name: 'health', url: `${BASE_URL}/api/health` },
      { name: 'detailed', url: `${BASE_URL}/api/health/detailed` },
      { name: 'live', url: `${BASE_URL}/api/health/live` },
      { name: 'ready', url: `${BASE_URL}/api/health/ready` },
    ];

    for (const ep of endpoints) {
      const res = http.get(ep.url, { tags: { endpoint: ep.name } });
      healthTrend.add(res.timings.duration);
      healthFailRate.add(res.status !== 200);

      check(res, {
        [`${ep.name} status 200`]: (r) => r.status === 200,
        [`${ep.name} response < 200ms`]: (r) => r.timings.duration < 200,
      });

      sleep(0.1);
    }
  });
}

export function handleSummary(data) {
  return {
    'reports/k6-health-check.json': JSON.stringify({
      summary: {
        avg: data.metrics.health_response_time?.values?.avg || 0,
        min: data.metrics.health_response_time?.values?.min || 0,
        med: data.metrics.health_response_time?.values?.med || 0,
        max: data.metrics.health_response_time?.values?.max || 0,
        p90: data.metrics.health_response_time?.values?.['p(90)'] || 0,
        p95: data.metrics.health_response_time?.values?.['p(95)'] || 0,
        error_rate: data.metrics.health_errors?.values?.rate || 0,
        passed: healthFailRate.values?.rate < 0.01,
      },
    }),
  };
}
