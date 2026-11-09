import { test as base, expect } from '@playwright/test';
import { config, type AppConfig } from '../config/env';
import { buildUser, type TestUser } from '../test-data/userFactory';
import { createLogger, type Logger } from '../utils/logger';

interface FrameworkFixtures {
  appConfig: AppConfig;
  log: Logger;
  newUser: TestUser;
}

export const test = base.extend<FrameworkFixtures>({
  appConfig: async ({}, use) => {
    await use(config);
  },

  log: async ({}, use, testInfo) => {
    await use(createLogger(`w${testInfo.workerIndex}`, config.logLevel));
  },

  newUser: async ({}, use, testInfo) => {
    await use(buildUser({ runId: config.runId, workerIndex: testInfo.workerIndex }));
  },
});

export { expect };
