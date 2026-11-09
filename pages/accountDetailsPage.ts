import type { Page } from '@playwright/test';
import { BasePage } from './basePage';
import { parseCurrencyToCents } from '../utils/money';

export interface AccountDetails {
  accountId: string;
  accountType: string;
  balanceCents: number;
}

export class AccountDetailsPage extends BasePage {
  protected readonly path = 'activity.htm';

  constructor(page: Page) {
    super(page);
  }

  async read(accountId: string): Promise<AccountDetails> {
    await this.page.goto(`${this.path}?id=${encodeURIComponent(accountId)}`);
    const table = this.page.locator('#accountTable');
    await table.waitFor({ state: 'visible' });
    const valueFor = async (label: string): Promise<string> => {
      const row = table.getByRole('row').filter({ hasText: label });
      return ((await row.getByRole('cell').nth(1).textContent()) ?? '').trim();
    };
    const displayedAccountId = await valueFor('Account Number');
    const accountType = await valueFor('Account Type');
    const balance = await valueFor('Balance');
    return {
      accountId: displayedAccountId,
      accountType,
      balanceCents: parseCurrencyToCents(balance),
    };
  }
}
