export const VU = __ENV.VU ? parseInt(__ENV.VU) : 10;
export const DURATION = __ENV.DURATION || '30s';
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const thresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  iterations: [`rate>${VU * 5}`],
};

export function rampUpStages(maxVus, rampUp = '2m', steady = '3m', rampDown = '1m') {
  return [
    { target: 0, duration: '10s' },
    { target: Math.ceil(maxVus * 0.3), duration: rampUp },
    { target: maxVus, duration: rampUp },
    { target: maxVus, duration: steady },
    { target: 0, duration: rampDown },
  ];
}

export function smokeTestStages() {
  return [{ target: 1, duration: '30s' }];
}

export function stressTestStages(maxVus) {
  return [
    { target: 0, duration: '10s' },
    { target: Math.ceil(maxVus * 0.2), duration: '1m' },
    { target: Math.ceil(maxVus * 0.5), duration: '2m' },
    { target: maxVus, duration: '3m' },
    { target: 0, duration: '2m' },
  ];
}
