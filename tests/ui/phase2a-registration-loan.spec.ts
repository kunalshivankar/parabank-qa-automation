import { expect, test } from '../../fixtures';
import { AccountDetailsPage } from '../../pages/accountDetailsPage';
import { AdminPage } from '../../pages/adminPage';
import { RequestLoanPage } from '../../pages/requestLoanPage';
import { buildUser } from '../../test-data/userFactory';
import { loginAndOpenChecking, registerCustomer, registrationUser } from './phase2aWorkflow';

function markBlocked(testInfo: { annotations: Array<{ type: string; description?: string }> }, reason: string): void {
  testInfo.annotations.push({ type: 'blocked', description: reason });
}

test.describe('Phase 2A - registration and loan orchestration', () => {
  test('automatic registration, login, and checking account workflow', async ({ page, newUser, appConfig, log }, testInfo) => {
    test.skip(appConfig.registrationMode !== 'automatic', 'Automatic registration mode is not selected.');

    const registration = await registerCustomer(page, newUser, log, () =>
      buildUser({ runId: appConfig.runId, workerIndex: testInfo.workerIndex }),
    );
    const result = await loginAndOpenChecking(page, registration.user, log);
    expect(result.fundingAccountId).toMatch(/^\d+$/);
    expect(result.checkingAccountId).toMatch(/^\d+$/);
    expect(result.checkingAccount.accountId).toBe(result.checkingAccountId);
    expect(result.checkingAccount.accountType).toMatch(/checking/i);
    expect(Number.isSafeInteger(result.checkingAccount.balanceCents)).toBe(true);
  });

  test('manual registration, login, and checking account workflow', async ({ page, newUser, appConfig, log }) => {
    test.skip(appConfig.registrationMode !== 'manual', 'Manual registration mode is not selected.');

    const user = registrationUser(appConfig, newUser);
    const registration = await registerCustomer(page, user, log);
    const result = await loginAndOpenChecking(page, registration.user, log);
    expect(result.fundingAccountId).toMatch(/^\d+$/);
    expect(result.checkingAccountId).toMatch(/^\d+$/);
    expect(result.checkingAccount.accountId).toBe(result.checkingAccountId);
    expect(result.checkingAccount.accountType).toMatch(/checking/i);
    expect(Number.isSafeInteger(result.checkingAccount.balanceCents)).toBe(true);
  });

  test('loan workflow uses the existing authorized provider only', async ({ page, newUser, appConfig, log }, testInfo) => {
    const provider = await new AdminPage(page).readLoanProvider();
    log.info('Loan Provider inspected without changing global settings', { provider });

    if (!appConfig.allowLoanWorkflow) {
      const reason = 'BLOCKED: PARABANK_ALLOW_LOAN_WORKFLOW is false; loan execution is not authorized.';
      markBlocked(testInfo, reason);
      test.skip(true, reason);
    }
    if (provider !== 'ws') {
      const reason = `BLOCKED: required Web Service Loan Provider is not configured; observed provider=${provider || '<empty>'}.`;
      markBlocked(testInfo, reason);
      test.skip(true, reason);
    }

    const user = registrationUser(appConfig, newUser);
    const registration = await registerCustomer(page, user, log);
    const result = await loginAndOpenChecking(page, registration.user, log);

    const loanAmount = 200;
    const downPayment = 50;
    const loanResult = await new RequestLoanPage(page).apply(result.checkingAccountId, loanAmount, downPayment);
    expect(['Approved', 'Denied']).toContain(loanResult.status);
    expect(loanResult.responseText).not.toBe('');
    log.info('Loan application response observed', {
      status: loanResult.status,
      provider,
      loanAccountId: loanResult.loanAccountId || undefined,
    });

    if (loanResult.status === 'Approved') {
      expect(loanResult.loanAccountId).toMatch(/^\d+$/);
      const loanAccount = await new AccountDetailsPage(page).read(loanResult.loanAccountId);
      expect(loanAccount.accountId).toBe(loanResult.loanAccountId);
      expect(loanAccount.accountType).toMatch(/loan/i);
      expect(Number.isSafeInteger(loanAccount.balanceCents)).toBe(true);
    } else {
      expect(loanResult.loanAccountId).toBe('');
    }
  });
});
