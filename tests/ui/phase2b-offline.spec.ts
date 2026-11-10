import { expect, test } from '../../fixtures';
import { FindTransactionsPage } from '../../pages/findTransactionsPage';
import { RegisterPage } from '../../pages/registerPage';
import { TransferFundsPage } from '../../pages/transferFundsPage';
import type { TestUser } from '../../test-data/userFactory';
import { sumCents } from '../../utils/money';

const testUser: TestUser = {
  firstName: 'Asha',
  lastName: 'Tester',
  address: '1 Test Street',
  city: 'Pune',
  state: 'MH',
  zipCode: '41100',
  phoneNumber: '9876543210',
  ssn: '123-45-6789',
  username: 'qa_payload_check',
  password: 'Qa1!offline-test',
};

test('registration form submits all expected fields and the generated username', async ({ page }) => {
  let submittedBody = '';
  await page.route('**/parabank/register.htm', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><form method="post" action="/parabank/register.htm">
          <input name="customer.firstName"><input name="customer.lastName">
          <input name="customer.address.street"><input name="customer.address.city">
          <input name="customer.address.state"><input name="customer.address.zipCode">
          <input name="customer.phoneNumber"><input name="customer.ssn">
          <input name="customer.username"><input name="customer.password">
          <input name="repeatedPassword"><button type="submit">Register</button>
        </form>`,
      });
      return;
    }

    submittedBody = route.request().postData() ?? '';
    await route.fulfill({
      contentType: 'text/html',
      body: '<main id="rightPanel">Registration complete</main>',
    });
  });

  const submission = await new RegisterPage(page).register(testUser);
  const fields = new URLSearchParams(submittedBody);

  expect(submission.requestMethod).toBe('POST');
  expect(submission.submittedUsername).toBe(testUser.username);
  expect(submission.responseStatus).toBe(200);
  expect(submission.resultText).toBe('Registration complete');
  expect(Object.fromEntries(fields)).toEqual({
    'customer.firstName': testUser.firstName,
    'customer.lastName': testUser.lastName,
    'customer.address.street': testUser.address,
    'customer.address.city': testUser.city,
    'customer.address.state': testUser.state,
    'customer.address.zipCode': testUser.zipCode,
    'customer.phoneNumber': testUser.phoneNumber,
    'customer.ssn': testUser.ssn,
    'customer.username': testUser.username,
    'customer.password': testUser.password,
    repeatedPassword: testUser.password,
  });
});

test('transfer page uses selected accounts and exact required amounts', async ({ page }) => {
  const completedTransfers: Array<{ source: string | null; destination: string | null; amount: string | null }> = [];
  const transfers = [
    { amount: '$150.00', cents: 15000 },
    { amount: '$25.50', cents: 2550 },
    { amount: '$8.99', cents: 899 },
  ] as const;

  await page.route('**/parabank/transfer.htm', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><form method="get" action="/parabank/transfercomplete.htm">
        <select id="fromAccountId" name="fromAccountId"><option value="111">111</option><option value="222">222</option></select>
        <select id="toAccountId" name="toAccountId"><option value="111">111</option><option value="222">222</option></select>
        <input id="amount" name="amount"><button type="submit">Transfer</button>
      </form>`,
    });
  });
  await page.route('**/parabank/transfercomplete.htm**', async (route) => {
    const url = new URL(route.request().url());
    completedTransfers.push({
      source: url.searchParams.get('fromAccountId'),
      destination: url.searchParams.get('toAccountId'),
      amount: url.searchParams.get('amount'),
    });
    await route.fulfill({
      contentType: 'text/html',
      body: '<main id="rightPanel">Transfer Complete!</main>',
    });
  });

  const transferPage = new TransferFundsPage(page);
  const accounts = await transferPage.accountOptions();
  expect(accounts).toEqual(['111', '222']);

  for (const { amount, cents } of transfers) {
    const result = await transferPage.transfer('111', '222', amount);
    expect(result.confirmationText).toBe('Transfer Complete!');
    expect(result.sourceAccountId).toBe('111');
    expect(result.destinationAccountId).toBe('222');
    expect(result.amountCents).toBe(cents);
    await page.goto('transfer.htm');
  }

  expect(completedTransfers).toEqual([
    { source: '111', destination: '222', amount: '$150.00' },
    { source: '111', destination: '222', amount: '$25.50' },
    { source: '111', destination: '222', amount: '$8.99' },
  ]);
  expect(sumCents(transfers.map((transfer) => transfer.cents))).toBe(18449);
});

test('Find Transactions extracts transaction rows and sums exact cents', async ({ page }) => {
  await page.route('**/parabank/findtrans.htm', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><select id="accountId"><option value="111">111</option></select>
        <input id="amount"><button type="button">Find Transactions</button>
        <table id="transactionTable"><tbody>
          <tr><td>701</td><td>11/10/2026</td><td>Transfer</td><td>Debit</td><td>-$150.00</td></tr>
          <tr><td>702</td><td>11/10/2026</td><td>Transfer</td><td>Debit</td><td>-$25.50</td></tr>
          <tr><td>703</td><td>11/10/2026</td><td>Transfer</td><td>Debit</td><td>-$8.99</td></tr>
        </tbody></table>`,
    });
  });

  const search = new FindTransactionsPage(page);
  const expectedAmounts = ['$150.00', '$25.50', '$8.99'];
  const observedAmounts: number[] = [];

  for (const amount of expectedAmounts) {
    const transactions = await search.searchByAmount('111', amount);
    expect(await page.locator('#amount').inputValue()).toBe(amount);
    expect(transactions.map((transaction) => transaction.transactionId)).toEqual(['701', '702', '703']);
    const matching = transactions.find((transaction) => Math.abs(transaction.amountCents) === Math.abs(Number(amount.replace(/[$.]/g, ''))));
    expect(matching, `transaction history should return the ${amount} row`).toBeDefined();
    if (matching === undefined) {
      throw new Error(`Missing offline transaction row for ${amount}.`);
    }
    observedAmounts.push(Math.abs(matching.amountCents));
  }

  expect(observedAmounts).toEqual([15000, 2550, 899]);
  expect(sumCents(observedAmounts)).toBe(18449);
});