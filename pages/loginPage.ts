import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class LoginPage extends BasePage {
  protected readonly path = 'index.htm';
  private readonly loginError = this.page.locator('#rightPanel').getByText(/could not be verified/i);

  constructor(page: Page) {
    super(page);
  }

  async login(username: string, password: string): Promise<void> {
    await this.open();
    await this.page.locator('input[name="username"]').fill(username);
    await this.page.locator('input[name="password"]').fill(password);
    await this.page.getByRole('button', { name: 'Log In' }).click();
    const outcome = await Promise.race([
      this.page.waitForURL(/\/parabank\/overview\.htm(?:;jsessionid=[^?#]*)?(?:[?#].*)?$/).then(() => 'success' as const),
      this.loginError.waitFor({ state: 'visible' }).then(() => 'failure' as const),
    ]);
    if (outcome === 'failure') {
      throw new Error('ParaBank rejected the generated registration credentials during login.');
    }
  }
}
