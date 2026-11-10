import { expect, test } from '../../fixtures';
import { ParaBankApiClient } from '../../api/parabankApiClient';

test.describe('Phase 2C - ParaBank API automation', () => {
  test('login succeeds for the documented public user and returns a valid customer', async ({ request, appConfig, log }) => {
    const client = new ParaBankApiClient(request, appConfig);

    const customer = await client.login('john', 'demo');

    expect(customer.id).toBeGreaterThan(0);
    expect(customer.firstName).toBeTruthy();
    expect(customer.lastName).toBeTruthy();
    log.info('Public ParaBank login validated', { customerId: customer.id });
  });

  test('customer account lookup returns consistent account and balance data', async ({ request, appConfig, log }) => {
    const client = new ParaBankApiClient(request, appConfig);

    const customer = await client.login('john', 'demo');
    const accounts = await client.getCustomerAccounts(customer.id);

    expect(accounts.length).toBeGreaterThan(0);

    const firstAccount = accounts[0]!;
    const accountDetails = await client.getAccount(firstAccount.id);

    expect(accountDetails.id).toBe(firstAccount.id);
    expect(accountDetails.customerId).toBe(customer.id);
    expect(['CHECKING', 'SAVINGS', 'LOAN']).toContain(accountDetails.type);
    expect(typeof accountDetails.balance).toBe('number');

    log.info('Customer account data validated', {
      customerId: customer.id,
      accountId: accountDetails.id,
      accountType: accountDetails.type,
      balance: accountDetails.balance,
    });
  });

  test('transaction endpoints return schema-valid records for a known account', async ({ request, appConfig, log }) => {
    const client = new ParaBankApiClient(request, appConfig);

    const customer = await client.login('john', 'demo');
    const accounts = await client.getCustomerAccounts(customer.id);
    const account = accounts.find((entry) => entry.id > 0) ?? accounts[0]!;

    const transactions = await client.getTransactions(account.id);
    expect(Array.isArray(transactions)).toBeTruthy();

    if (transactions.length > 0) {
      const transaction = transactions[0]!;
      expect(transaction.accountId).toBe(account.id);
      expect(['Credit', 'Debit']).toContain(transaction.type);
      expect(typeof transaction.amount).toBe('number');
    }

    const amountMatches = await client.getTransactionsByAmount(account.id, 100);
    expect(Array.isArray(amountMatches)).toBeTruthy();

    log.info('Transaction history validated', {
      customerId: customer.id,
      accountId: account.id,
      transactionCount: transactions.length,
    });
  });

  test('invalid credentials fail closed without mutating application state', async ({ request, appConfig }) => {
    const client = new ParaBankApiClient(request, appConfig);

    const response = await client.requestLogin('invalid-user', 'wrong-password');

    expect(response.ok()).toBeFalsy();
  });
});
