import { defineConfig, devices } from '@playwright/test';
import { config } from './config/env';

const isCI = Boolean(process.env.CI);
const chromiumExecutable = process.env.CHROMIUM_EXECUTABLE_PATH || undefined;
const retainRawArtifacts = process.env.PARABANK_RETAIN_RAW_ARTIFACTS === 'true';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: config.workers,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['./reporters/glassReporter.ts', { outputFile: 'reports/parabank-report.html' }],
  ],
  use: {
    baseURL: config.parabankUrl,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: retainRawArtifacts ? 'retain-on-failure' : 'off',
    trace: retainRawArtifacts ? 'retain-on-failure' : 'off',
    launchOptions: { executablePath: chromiumExecutable },
  },
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
    },
    {
      name: 'reporter-ui',
      testDir: './tests/reporter',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
    },
  ],
});
