import { randomBytes, randomInt } from 'node:crypto';

export interface TestUser {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

export type ManualUserInput = Omit<TestUser, 'password'> & { password: string };

export interface UserSeed {
  runId: string;
  workerIndex: number;
}

export function buildManualUser(input: ManualUserInput): TestUser {
  return { ...input };
}

let sequence = 0;

/** ParaBank exposes no HTML maxlength on the username field; keep generated values compact for backend compatibility. */
export const GENERATED_USERNAME_MAX_LENGTH = 30;

const FIRST_NAMES = ['Asha', 'Rohan', 'Meera', 'Kabir', 'Ira', 'Vikram', 'Nisha', 'Arjun'];
const LAST_NAMES = ['Deshmukh', 'Kulkarni', 'Patil', 'Joshi', 'Bhosale', 'Gokhale', 'Sathe', 'Rane'];
const CITIES = ['Nagpur', 'Pune', 'Nashik', 'Aurangabad'];

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)] as T;
}

function digits(count: number): string {
  return Array.from({ length: count }, () => randomInt(10)).join('');
}

export function buildUser({ runId, workerIndex }: UserSeed): TestUser {
  sequence += 1;
  const compactRunId = runId.slice(-8);
  const suffix = randomBytes(6).toString('hex');
  const username = `qa_${compactRunId}w${workerIndex.toString(36)}${sequence.toString(36)}${suffix}`;
  if (username.length > GENERATED_USERNAME_MAX_LENGTH) {
    throw new Error('Generated ParaBank username exceeded the supported length.');
  }
  return {
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    address: `${randomInt(1, 999)} Test Street`,
    city: pick(CITIES),
    state: 'MH',
    zipCode: `4${digits(4)}`,
    phoneNumber: `9${digits(9)}`,
    ssn: `${digits(3)}-${digits(2)}-${digits(4)}`,
    username,
    password: `Qa1!${randomBytes(9).toString('base64url')}`,
  };
}
