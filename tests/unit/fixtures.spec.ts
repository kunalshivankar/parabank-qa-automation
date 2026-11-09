import { expect, test } from '../../fixtures';

const usernamesSeenInThisWorker = new Set<string>();

test.describe('framework fixtures', () => {
  test('appConfig exposes the safe defaults', ({ appConfig }) => {
    expect(appConfig.parabankUrl).toMatch(/\/parabank\/$/);
    expect(appConfig.runId).toMatch(/^[a-z0-9]{4,16}$/i);
  });

  test('newUser is tagged with this run and this worker', ({ newUser, appConfig }, testInfo) => {
    expect(newUser.username).toMatch(new RegExp(`^qa_${appConfig.runId.slice(-8)}w${testInfo.workerIndex.toString(36)}`));
  });

  for (const index of [1, 2, 3, 4, 5]) {
    test(`newUser is never reused across tests (check ${index})`, ({ newUser }) => {
      expect(usernamesSeenInThisWorker.has(newUser.username)).toBe(false);
      usernamesSeenInThisWorker.add(newUser.username);
    });
  }
});
