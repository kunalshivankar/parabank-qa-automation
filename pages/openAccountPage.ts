import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class OpenAccountPage extends BasePage {
  protected readonly path = 'openaccount.htm';

  private readonly type = this.page.locator('#type');
  private readonly fromAccount = this.page.locator('#fromAccountId');
  private readonly newAccountId = this.page.locator('#newAccountId');

  constructor(page: Page) {
    super(page);
  }

  async openCheckingAccount(fundingAccountId: string): Promise<string> {
    await this.open();
    await this.fromAccount.locator(`option[value="${fundingAccountId}"]`).waitFor({ state: 'attached' });
    await this.type.selectOption('CHECKING');
    await this.fromAccount.selectOption(fundingAccountId);
    await this.page.getByRole('button', { name: 'Open New Account' }).click();
    await this.page.waitForURL(this.urlPattern);
    await this.newAccountId.waitFor({ state: 'visible' });
    const accountId = (await this.newAccountId.textContent())?.trim() ?? '';
    if (!/^\d+$/.test(accountId)) {
      throw new Error(`ParaBank did not return a valid new account number: ${accountId || '<empty>'}`);
    }
    return accountId;
  }
}
