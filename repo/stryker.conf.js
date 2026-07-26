export default {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'dashboard'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'apps/backend/src/services/**/*.js',
    'apps/backend/src/routes/**/*.js',
    'apps/backend/src/middleware/**/*.js',
    'apps/backend/src/auth/**/*.js',
    '!apps/backend/src/**/*.test.js',
    '!apps/backend/src/**/__tests__/**',
  ],
  thresholds: { high: 80, low: 60, break: 50 },
  timeoutMS: 30000,
  timeoutFactor: 2,
};
