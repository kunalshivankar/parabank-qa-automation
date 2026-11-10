import type { Page } from '@playwright/test';
import { BasePage } from './basePage';
import { parseCurrencyToCents } from '../utils/money';

export interface TransferResult {
  confirmationText: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
}

/** Page object for the authenticated ParaBank funds-transfer screen. */
export class TransferFundsPage extends BasePage {
  protected readonly path = 'transfer.htm';
  private readonly sourceAccount = this.page.locator('#fromAccountId');
  private readonly destinationAccount = this.page.locator('#toAccountId');
  private readonly amount = this.page.locator('#amount');
  private readonly transferButton = this.page.getByRole('button', { name: /^Transfer$/i });

  constructor(page: Page) {
    super(page);
  }

  async accountOptions(): Promise<string[]> {
    await this.open();
    await this.sourceAccount.waitFor({ state: 'visible' });
    return this.sourceAccount.locator('option').evaluateAll((options) =>
      options.map((option) => option.getAttribute('value') ?? '').filter((value) => /^\d+$/.test(value)),
    );
  }

  async transfer(sourceAccountId: string, destinationAccountId: string, amount: string): Promise<TransferResult> {
    await this.sourceAccount.selectOption(sourceAccountId);
    await this.destinationAccount.selectOption(destinationAccountId);
    await this.amount.fill(amount);
    await this.transferButton.click();
    await this.page.waitForURL(/\/parabank\/transfercomplete\.htm(?:;jsessionid=[^?#]*)?(?:[?#].*)?$/);
    const confirmationText = (await this.page.locator('#rightPanel').innerText()).trim();
    return {
      confirmationText,
      sourceAccountId,
      destinationAccountId,
      amountCents: parseCurrencyToCents(amount),
    };
  }
}
