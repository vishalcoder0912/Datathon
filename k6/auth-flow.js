import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, thresholds, rampUpStages } from './options.js';

const registerTrend = new Trend('auth_register_time');
const loginTrend = new Trend('auth_login_time');
const refreshTrend = new Trend('auth_refresh_time');
const authErrorRate = new Rate('auth_errors');

const CONCURRENT_USERS = parseInt(__ENV.VU) || 100;

export let options = {
  stages: rampUpStages(CONCURRENT_USERS, '1m', '3m', '1m'),
  thresholds: {
    ...thresholds,
    auth_register_time: ['p(95)<1000', 'p(99)<2000'],
    auth_login_time: ['p(95)<500', 'p(99)<1000'],
    auth_refresh_time: ['p(95)<500', 'p(99)<1000'],
    auth_errors: ['rate<0.02'],
  },
};

function randomEmail() {
  return `loadtest_${__VU}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.insightflow.ai`;
}

export default function () {
  group('Auth Flow', function () {
    const email = randomEmail();
    const password = 'Test@123456!';

    const registerPayload = JSON.stringify({
      email,
      password,
      name: `LoadTest User ${__VU}`,
    });

    const registerRes = http.post(`${BASE_URL}/api/auth/register`, registerPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'register' },
    });

    registerTrend.add(registerRes.timings.duration);
    authErrorRate.add(registerRes.status >= 400);

    check(registerRes, {
      'register status 201': (r) => r.status === 201,
      'register fast enough': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);

    const loginPayload = JSON.stringify({ email, password });
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'login' },
    });

    loginTrend.add(loginRes.timings.duration);
    authErrorRate.add(loginRes.status >= 400);

    let accessToken = '';
    check(loginRes, {
      'login status 200': (r) => r.status === 200,
      'login fast enough': (r) => r.timings.duration < 500,
      'has access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          accessToken = body.data?.accessToken || body.accessToken || '';
          return accessToken.length > 0;
        } catch { return false; }
      },
    });

    if (!accessToken) return;

    sleep(0.3);

    const refreshRes = http.post(`${BASE_URL}/api/auth/refresh`, JSON.stringify({ refreshToken: '' }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      tags: { endpoint: 'refresh' },
    });

    refreshTrend.add(refreshRes.timings.duration);
    authErrorRate.add(refreshRes.status >= 400);

    check(refreshRes, {
      'refresh status 200': (r) => r.status === 200,
      'refresh fast enough': (r) => r.timings.duration < 500,
    });

    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      tags: { endpoint: 'me' },
    });

    check(meRes, {
      'me status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/k6-auth-flow.json': JSON.stringify({
      summary: {
        register: {
          avg: data.metrics.auth_register_time?.values?.avg || 0,
          p95: data.metrics.auth_register_time?.values?.['p(95)'] || 0,
          p99: data.metrics.auth_register_time?.values?.['p(99)'] || 0,
        },
        login: {
          avg: data.metrics.auth_login_time?.values?.avg || 0,
          p95: data.metrics.auth_login_time?.values?.['p(95)'] || 0,
          p99: data.metrics.auth_login_time?.values?.['p(99)'] || 0,
        },
        refresh: {
          avg: data.metrics.auth_refresh_time?.values?.avg || 0,
          p95: data.metrics.auth_refresh_time?.values?.['p(95)'] || 0,
          p99: data.metrics.auth_refresh_time?.values?.['p(99)'] || 0,
        },
        error_rate: data.metrics.auth_errors?.values?.rate || 0,
        passed: (data.metrics.auth_errors?.values?.rate || 1) < 0.02,
      },
    }),
  };
}
