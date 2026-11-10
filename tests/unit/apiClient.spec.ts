import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { parseConfig } from '../../config/env';
import { ParaBankApiClient } from '../../api/parabankApiClient';

function createClient(allowApiDeposit = false, apiDepositAccountId?: number) {
  const calls: Array<{ url: string; options: { params: Record<string, number | string>; headers: Record<string, string> } }> = [];
  const request = {
    post: (
      url: string,
      options: { params: Record<string, number | string>; headers: Record<string, string> },
    ) => {
      calls.push({ url, options });
      return Promise.resolve({
        ok: () => true,
        status: () => 200,
        text: () => Promise.resolve('<string>Deposit accepted</string>'),
      });
    },
  } as unknown as APIRequestContext;
  const source: NodeJS.ProcessEnv = {
    RUN_ID: 'api123',
    PARABANK_ALLOW_API_DEPOSIT: String(allowApiDeposit),
  };
  if (apiDepositAccountId !== undefined) {
    source.PARABANK_API_DEPOSIT_ACCOUNT_ID = String(apiDepositAccountId);
  }
  return { client: new ParaBankApiClient(request, parseConfig(source)), calls };
}

test.describe('ParaBank API deposit guard', () => {
  test('blocks deposits when the feature is not explicitly enabled', async () => {
    const { client, calls } = createClient();

    await expect(client.deposit(12345, 18449)).rejects.toThrow(/explicit authorization/);
    expect(calls).toHaveLength(0);
  });

  test('sends exact amount and account only for the allowlisted account', async () => {
    const { client, calls } = createClient(true, 12345);

    await expect(client.deposit(12345, 18449)).resolves.toBe('<string>Deposit accepted</string>');
    expect(calls).toEqual([
      {
        url: 'https://parabank.parasoft.com/parabank/services/bank/deposit',
        options: {
          params: { accountId: 12345, amount: '184.49' },
          headers: { Accept: 'application/xml' },
        },
      },
    ]);
  });

  test('blocks a different account and invalid cent amounts before making a request', async () => {
    const { client, calls } = createClient(true, 12345);

    await expect(client.deposit(54321, 100)).rejects.toThrow(/exact account ID/);
    await expect(client.deposit(12345, 0)).rejects.toThrow(/positive safe integer/);
    await expect(client.deposit(12345, 100.5)).rejects.toThrow(/positive safe integer/);
    expect(calls).toHaveLength(0);
  });
});