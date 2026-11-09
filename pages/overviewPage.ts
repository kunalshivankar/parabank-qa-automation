import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class OverviewPage extends BasePage {
  protected readonly path = 'overview.htm';

  constructor(page: Page) {
    super(page);
  }

  async accountIds(): Promise<string[]> {
    const links = this.page.locator('a[href*="activity.htm?id="]');
    await links.first().waitFor({ state: 'visible' });
    return links.evaluateAll((items) =>
      items
        .map((item) => new URL(item.getAttribute('href') ?? '', window.location.href).searchParams.get('id'))
        .filter((id): id is string => id !== null),
    );
  }
}
