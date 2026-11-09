import { expect, test } from '@playwright/test';
import { assertGlobalResetAllowed, config, parseConfig } from '../../config/env';

const baseEnv = { RUN_ID: 'abc123' };

test.describe('parseConfig', () => {
  test('applies safe defaults', () => {
    const parsed = parseConfig(baseEnv);
    expect(parsed.baseUrl).toBe('https://parabank.parasoft.com');
    expect(parsed.parabankUrl).toBe('https://parabank.parasoft.com/parabank/');
    expect(parsed.allowGlobalReset).toBe(false);
    expect(parsed.allowLoanWorkflow).toBe(false);
    expect(parsed.workers).toBe(2);
    expect(parsed.logLevel).toBe('info');
    expect(parsed.runId).toBe('abc123');
  });

  test('treats blank values as unset', () => {
    const parsed = parseConfig({ ...baseEnv, PARABANK_ALLOW_GLOBAL_RESET: '', WORKERS: '' });
    expect(parsed.allowGlobalReset).toBe(false);
    expect(parsed.workers).toBe(2);
  });

  test('removes trailing slashes from the base URL', () => {
    expect(parseConfig({ ...baseEnv, PARABANK_BASE_URL: 'https://example.test///' }).parabankUrl).toBe(
      'https://example.test/parabank/',
    );
  });

  test('accepts an explicit opt-in for global reset', () => {
    expect(parseConfig({ ...baseEnv, PARABANK_ALLOW_GLOBAL_RESET: 'true' }).allowGlobalReset).toBe(true);
  });

  test('accepts an explicit opt-in for the loan workflow', () => {
    expect(parseConfig({ ...baseEnv, PARABANK_ALLOW_LOAN_WORKFLOW: 'true' }).allowLoanWorkflow).toBe(true);
  });

  test('uses automatic registration by default', () => {
    const parsed = parseConfig(baseEnv);
    expect(parsed.registrationMode).toBe('automatic');
    expect(parsed.manualUser).toBeUndefined();
  });

  test('loads a complete manual registration user from environment values', () => {
    const parsed = parseConfig({
      ...baseEnv,
      REGISTRATION_MODE: 'manual',
      MANUAL_FIRST_NAME: 'Asha',
      MANUAL_LAST_NAME: 'Tester',
      MANUAL_ADDRESS: '1 Test Street',
      MANUAL_CITY: 'Pune',
      MANUAL_STATE: 'MH',
      MANUAL_ZIP_CODE: '41100',
      MANUAL_PHONE_NUMBER: '9876543210',
      MANUAL_SSN: '123-45-6789',
      MANUAL_USERNAME: 'manual_user_123',
      MANUAL_PASSWORD: 'Qa1!manual-password',
    });
    expect(parsed.registrationMode).toBe('manual');
    expect(parsed.manualUser?.username).toBe('manual_user_123');
    expect(parsed.manualUser?.password).toBe('Qa1!manual-password');
  });

  const invalidCases: Array<[string, Record<string, string>, RegExp]> = [
    ['an ambiguous reset flag', { PARABANK_ALLOW_GLOBAL_RESET: 'yes' }, /PARABANK_ALLOW_GLOBAL_RESET/],
    ['an uppercase reset flag', { PARABANK_ALLOW_GLOBAL_RESET: 'TRUE' }, /PARABANK_ALLOW_GLOBAL_RESET/],
    ['a malformed base URL', { PARABANK_BASE_URL: 'not a url' }, /PARABANK_BASE_URL/],
    ['zero workers', { WORKERS: '0' }, /WORKERS/],
    ['too many workers', { WORKERS: '50' }, /WORKERS/],
    ['non-numeric workers', { WORKERS: 'many' }, /WORKERS/],
    ['an unknown log level', { LOG_LEVEL: 'verbose' }, /LOG_LEVEL/],
    ['an unknown registration mode', { REGISTRATION_MODE: 'interactive' }, /REGISTRATION_MODE/],
    ['an unsafe run id', { RUN_ID: 'a b/c' }, /RUN_ID/],
  ];
  for (const [name, overrides, message] of invalidCases) {
    test(`rejects ${name}`, () => {
      expect(() => parseConfig({ ...baseEnv, ...overrides })).toThrow(message);
    });
  }

  test('rejects incomplete manual registration data', () => {
    expect(() => parseConfig({ ...baseEnv, REGISTRATION_MODE: 'manual' })).toThrow(/MANUAL_FIRST_NAME/);
  });
});

test.describe('assertGlobalResetAllowed', () => {
  test('blocks the reset when the flag is off', () => {
    expect(() => assertGlobalResetAllowed(parseConfig(baseEnv))).toThrow(/Global database reset is disabled/);
  });

  test('allows the reset only when the flag is explicitly on', () => {
    expect(() =>
      assertGlobalResetAllowed(parseConfig({ ...baseEnv, PARABANK_ALLOW_GLOBAL_RESET: 'true' })),
    ).not.toThrow();
  });
});

test('the run id is published to process.env so worker processes share it', () => {
  expect(process.env.RUN_ID).toBe(config.runId);
});
