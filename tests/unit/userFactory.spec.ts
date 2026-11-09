import { expect, test } from '@playwright/test';
import { buildUser, GENERATED_USERNAME_MAX_LENGTH } from '../../test-data/userFactory';

test.describe('buildUser', () => {
  const seed = { runId: 'k3x9a2b1', workerIndex: 3 };

  test('embeds the run id and worker index in the username', () => {
    expect(buildUser(seed).username).toMatch(/^qa_k3x9a2b1w3[0-9a-z]+[0-9a-f]{12}$/);
  });

  test('uses a strictly increasing sequence so usernames cannot collide inside one process', () => {
    const users = Array.from({ length: 50 }, () => buildUser(seed).username);
    expect(new Set(users).size).toBe(users.length);
  });

  test('generates unique usernames and passwords across many calls', () => {
    const users = Array.from({ length: 20_000 }, () => buildUser(seed));
    expect(new Set(users.map((user) => user.username)).size).toBe(users.length);
    expect(new Set(users.map((user) => user.password)).size).toBe(users.length);
  });

  test('keeps different workers in different username spaces', () => {
    const first = buildUser({ runId: 'run1', workerIndex: 0 }).username;
    const second = buildUser({ runId: 'run1', workerIndex: 1 }).username;
    expect(first.startsWith('qa_run1w0')).toBe(true);
    expect(second.startsWith('qa_run1w1')).toBe(true);
  });

  test('keeps generated usernames within the bounded registration length', () => {
    expect(buildUser(seed).username.length).toBeLessThanOrEqual(GENERATED_USERNAME_MAX_LENGTH);
  });

  test('produces fully populated registration data', () => {
    const user = buildUser(seed);
    expect(user.firstName).not.toBe('');
    expect(user.lastName).not.toBe('');
    expect(user.address).not.toBe('');
    expect(user.city).not.toBe('');
    expect(user.state).toHaveLength(2);
    expect(user.zipCode).toMatch(/^\d{5}$/);
    expect(user.phoneNumber).toMatch(/^\d{10}$/);
    expect(user.ssn).toMatch(/^\d{3}-\d{2}-\d{4}$/);
  });

  test('generates passwords that satisfy common complexity rules', () => {
    const { password } = buildUser(seed);
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });
});
