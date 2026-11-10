import { expect, test } from '../../fixtures';
import { AccountDetailsPage } from '../../pages/accountDetailsPage';
import { FindTransactionsPage } from '../../pages/findTransactionsPage';
import { LoginPage } from '../../pages/loginPage';
import { TransferFundsPage } from '../../pages/transferFundsPage';
import { formatCents, parseCurrencyToCents, sumCents } from '../../utils/money';

const TRANSFERS = ['$150.00', '$25.50', '$8.99'] as const;

function markBlocked(testInfo: { annotations: Array<{ type: string; description?: string }> }, reason: string): void {
  testInfo.annotations.push({ type: 'blocked', description: reason });
}

function requireAuthorizedAccount(
  appConfig: { allowTransferWorkflow: boolean; transferUsername?: string; transferPassword?: string },
  testInfo: { annotations: Array<{ type: string; description?: string }> },
): void {
  if (!appConfig.allowTransferWorkflow) {
    const reason =
      'BLOCKED: PARABANK_ALLOW_TRANSFER_WORKFLOW is false; no transfer will be executed against the shared sandbox.';
    markBlocked(testInfo, reason);
    test.skip(true, reason);
  }
  if (!appConfig.transferUsername || !appConfig.transferPassword) {
    const reason =
      'BLOCKED: authorized transfer credentials are not configured via PARABANK_TRANSFER_USERNAME/PARABANK_TRANSFER_PASSWORD.';
    markBlocked(testInfo, reason);
    test.skip(true, reason);
  }
}

test.describe('Phase 2B - funds transfer and transaction validation', () => {
  test('transfers all required amounts and reconciles source-account history', async ({ page, appConfig, log }, testInfo) => {
    requireAuthorizedAccount(appConfig, testInfo);

    await new LoginPage(page).login(appConfig.transferUsername!, appConfig.transferPassword!);
    const accounts = await new TransferFundsPage(page).accountOptions();
    expect(accounts.length, 'An authorized transfer account must expose at least two accounts.').toBeGreaterThanOrEqual(2);

    const sourceAccountId = accounts[0]!;
    const destinationAccountId = accounts[1]!;
    expect(destinationAccountId).not.toBe(sourceAccountId);

    const sourceBefore = await new AccountDetailsPage(page).read(sourceAccountId);
    const destinationBefore = await new AccountDetailsPage(page).read(destinationAccountId);
    const expectedTransferredCents = sumCents(TRANSFERS.map(parseCurrencyToCents));

    for (const amount of TRANSFERS) {
      const result = await new TransferFundsPage(page).transfer(sourceAccountId, destinationAccountId, amount);
      expect(result.confirmationText).toMatch(/transfer complete/i);
      expect(result.sourceAccountId).toBe(sourceAccountId);
      expect(result.destinationAccountId).toBe(destinationAccountId);
      expect(result.amountCents).toBe(parseCurrencyToCents(amount));
      log.info('Authorized funds transfer completed', {
        sourceAccountId,
        destinationAccountId,
        amountCents: result.amountCents,
      });
    }

    const sourceAfter = await new AccountDetailsPage(page).read(sourceAccountId);
    const destinationAfter = await new AccountDetailsPage(page).read(destinationAccountId);
    expect(sourceAfter.balanceCents).toBe(sourceBefore.balanceCents - expectedTransferredCents);
    expect(destinationAfter.balanceCents).toBe(destinationBefore.balanceCents + expectedTransferredCents);

    const transactions = await new FindTransactionsPage(page).searchByAmount(sourceAccountId, formatCents(expectedTransferredCents));
    const matchingTransfers = transactions.filter(
      (transaction) => transaction.type.toLowerCase().includes('debit') || transaction.description.toLowerCase().includes('transfer'),
    );
    expect(matchingTransfers.length).toBeGreaterThanOrEqual(TRANSFERS.length);
    expect(sumCents(matchingTransfers.slice(0, TRANSFERS.length).map((transaction) => Math.abs(transaction.amountCents)))).toBe(
      expectedTransferredCents,
    );
  });

  test('validates empty transfer amount through the application UI', async ({ page, appConfig }, testInfo) => {
    requireAuthorizedAccount(appConfig, testInfo);
    await new LoginPage(page).login(appConfig.transferUsername!, appConfig.transferPassword!);
    const transferPage = new TransferFundsPage(page);
    const accounts = await transferPage.accountOptions();
    expect(accounts.length).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#amount')).toBeVisible();
    await page.locator('#amount').fill('');
    await page.getByRole('button', { name: /^Transfer$/i }).click();
    await expect(page.locator('#amount')).toHaveAttribute('required', '');
  });
});
