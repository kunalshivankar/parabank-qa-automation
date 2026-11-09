import { BasePage } from './basePage';

export class AdminPage extends BasePage {
  protected readonly path = 'admin.htm';

  private readonly loanProvider = this.page.locator('#loanProvider');
  private readonly submit = this.page.getByRole('button', { name: 'Submit' });

  async readLoanProvider(): Promise<string> {
    await this.open();
    await this.loanProvider.waitFor({ state: 'visible' });
    return this.loanProvider.inputValue();
  }

  async setLoanProviderWebService(authorized: boolean): Promise<void> {
    if (!authorized) {
      throw new Error('Changing the global Loan Provider requires explicit environment authorization.');
    }
    await this.open();
    await this.loanProvider.selectOption('ws');
    await this.submit.click();
    await this.page.waitForURL(this.urlPattern);
    await this.loanProvider.waitFor({ state: 'attached' });
  }
}
