import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildManualUser, type TestUser } from '../test-data/userFactory';
import type { LogLevel } from '../utils/logger';

const ENV_FILE = path.resolve(__dirname, '..', '.env');

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

/**
 * The run id must be identical in the main process and in every worker, so it is created once
 * here and written back to process.env, which worker processes inherit.
 */
function ensureRunId(): string {
  const existing = process.env.RUN_ID?.trim();
  if (existing) {
    return existing;
  }
  const generated = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  process.env.RUN_ID = generated;
  return generated;
}

const booleanFlag = z
  .enum(['true', 'false'], { error: 'must be exactly "true" or "false"' })
  .default('false')
  .transform((value) => value === 'true');

const registrationMode = z.enum(['automatic', 'manual']).default('automatic');

const envSchema = z.object({
  PARABANK_BASE_URL: z
    .url({ error: 'must be a valid absolute URL' })
    .default('https://parabank.parasoft.com')
    .transform((value) => value.replace(/\/+$/, '')),
  PARABANK_ALLOW_GLOBAL_RESET: booleanFlag,
  PARABANK_ALLOW_LOAN_WORKFLOW: booleanFlag,
  WORKERS: z.coerce
    .number({ error: 'must be a number' })
    .int()
    .min(1)
    .max(8)
    .default(2),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  REGISTRATION_MODE: registrationMode,
  RUN_ID: z
    .string()
    .regex(/^[a-z0-9]{4,16}$/i, { error: 'must be 4-16 alphanumeric characters' }),
});

export interface AppConfig {
  readonly baseUrl: string;
  readonly parabankUrl: string;
  readonly allowGlobalReset: boolean;
  readonly allowLoanWorkflow: boolean;
  readonly workers: number;
  readonly logLevel: LogLevel;
  readonly runId: string;
  readonly registrationMode: 'automatic' | 'manual';
  readonly manualUser?: TestUser;
}

function readManualUser(env: z.infer<typeof envSchema>, source: NodeJS.ProcessEnv): TestUser | undefined {
  if (env.REGISTRATION_MODE !== 'manual') {
    return undefined;
  }

  const values = {
    firstName: source.MANUAL_FIRST_NAME?.trim(),
    lastName: source.MANUAL_LAST_NAME?.trim(),
    address: source.MANUAL_ADDRESS?.trim(),
    city: source.MANUAL_CITY?.trim(),
    state: source.MANUAL_STATE?.trim(),
    zipCode: source.MANUAL_ZIP_CODE?.trim(),
    phoneNumber: source.MANUAL_PHONE_NUMBER?.trim(),
    ssn: source.MANUAL_SSN?.trim(),
    username: source.MANUAL_USERNAME?.trim(),
    password: source.MANUAL_PASSWORD,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => value === undefined || value === '')
    .map(([key]) => `MANUAL_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);
  if (missing.length > 0) {
    throw new Error(`Manual registration mode requires: ${missing.join(', ')}`);
  }

  const user = buildManualUser(values as TestUser);
  if (!/^\d{5}$/.test(user.zipCode)) {
    throw new Error('MANUAL_ZIP_CODE must contain exactly five digits.');
  }
  if (!/^\d{10}$/.test(user.phoneNumber)) {
    throw new Error('MANUAL_PHONE_NUMBER must contain exactly ten digits.');
  }
  if (!/^\d{3}-\d{2}-\d{4}$/.test(user.ssn)) {
    throw new Error('MANUAL_SSN must use the ###-##-#### format.');
  }
  return user;
}

export function parseConfig(source: NodeJS.ProcessEnv): AppConfig {
  const withoutBlanks = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = envSchema.safeParse(withoutBlanks);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = result.data;
  return {
    baseUrl: env.PARABANK_BASE_URL,
    parabankUrl: `${env.PARABANK_BASE_URL}/parabank/`,
    allowGlobalReset: env.PARABANK_ALLOW_GLOBAL_RESET,
    allowLoanWorkflow: env.PARABANK_ALLOW_LOAN_WORKFLOW,
    workers: env.WORKERS,
    logLevel: env.LOG_LEVEL,
    runId: env.RUN_ID,
    registrationMode: env.REGISTRATION_MODE,
    manualUser: readManualUser(env, source),
  };
}

ensureRunId();

export const config: AppConfig = parseConfig(process.env);

export function assertGlobalResetAllowed(current: AppConfig = config): void {
  if (!current.allowGlobalReset) {
    throw new Error(
      'Global database reset is disabled. It wipes data for every user of the shared ParaBank sandbox. ' +
        'Set PARABANK_ALLOW_GLOBAL_RESET=true only on an environment you own.',
    );
  }
}
