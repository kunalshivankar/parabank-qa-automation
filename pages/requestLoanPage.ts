import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export interface LoanResult {
  status: string;
  loanAccountId: string;
  provider: string;
  responseText: string;
}

export class RequestLoanPage extends BasePage {
  protected readonly path = 'requestloan.htm';

  private readonly account = this.page.locator('#accountId');
  private readonly amount = this.page.locator('#amount');
  private readonly downPayment = this.page.locator('#downPayment');

  constructor(page: Page) {
    super(page);
  }

  async apply(accountId: string, amount: number, downPayment: number): Promise<LoanResult> {
    await this.open();
    await this.account.locator(`option[value="${accountId}"]`).waitFor({ state: 'attached' });
    await this.account.selectOption(accountId);
    await this.amount.fill(amount.toFixed(2));
    await this.downPayment.fill(downPayment.toFixed(2));
    await this.page.getByRole('button', { name: 'Apply Now' }).click();
    await this.page.waitForURL(/\/parabank\/requestloanresult\.htm(?:;jsessionid=[^?#]*)?(?:[?#].*)?$/);
    const text = await this.page.locator('#rightPanel').innerText();
    return {
      status: (await this.page.locator('#loanStatus').textContent())?.trim() ?? '',
      loanAccountId: (await this.page.locator('#loanAccountId').textContent())?.trim() ?? '',
      provider: (await this.page.locator('#loanProviderName').textContent())?.trim() ?? '',
      responseText: text.trim(),
    };
  }
}
