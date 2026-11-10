import type { Page } from '@playwright/test';
import { BasePage } from './basePage';
import { parseCurrencyToCents } from '../utils/money';

export interface TransactionRecord {
  transactionId: string;
  date: string;
  description: string;
  type: string;
  amountCents: number;
}

/** Page object for ParaBank's supported Find Transactions searches. */
export class FindTransactionsPage extends BasePage {
  protected readonly path = 'findtrans.htm';
  private readonly account = this.page.locator('#accountId');
  private readonly transactionId = this.page.locator('#transactionId');
  private readonly fromDate = this.page.locator('#fromDate');
  private readonly toDate = this.page.locator('#toDate');
  private readonly amount = this.page.locator('#amount');
  private readonly transactionTable = this.page.locator('#transactionTable');

  constructor(page: Page) {
    super(page);
  }

  async searchByAmount(accountId: string, amountText: string): Promise<TransactionRecord[]> {
    await this.open();
    await this.account.selectOption(accountId);
    await this.amount.fill(amountText);
    await this.page.getByRole('button', { name: /Find Transactions/i }).click();
    return this.readResults();
  }

  async searchByTransactionId(accountId: string, id: string): Promise<TransactionRecord[]> {
    await this.open();
    await this.account.selectOption(accountId);
    await this.transactionId.fill(id);
    await this.page.getByRole('button', { name: /Find Transactions/i }).click();
    return this.readResults();
  }

  async searchByDate(accountId: string, from: string, to: string): Promise<TransactionRecord[]> {
    await this.open();
    await this.account.selectOption(accountId);
    await this.fromDate.fill(from);
    await this.toDate.fill(to);
    await this.page.getByRole('button', { name: /Find Transactions/i }).click();
    return this.readResults();
  }

  private async readResults(): Promise<TransactionRecord[]> {
    const rows = this.transactionTable.locator('tbody tr');
    if ((await rows.count()) === 0) return [];
    return rows
      .evaluateAll((items) =>
        items.map((row) => {
          const cells = [...row.querySelectorAll('td')].map((cell) => (cell.textContent ?? '').trim());
          return {
            transactionId: cells[0] ?? '',
            date: cells[1] ?? '',
            description: cells[2] ?? '',
            type: cells[3] ?? '',
            rawAmount: cells[4] ?? '',
          };
        }),
      )
      .then((rows) =>
        rows.map(({ rawAmount, ...row }) => ({ ...row, amountCents: parseCurrencyToCents(rawAmount) })),
      );
  }
}
