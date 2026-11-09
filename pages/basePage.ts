import type { Page } from '@playwright/test';
import { parabankPagePattern } from '../utils/url';

/**
 * Base class for every page object. Page objects expose locators and user actions only;
 * assertions belong in the tests.
 */
export abstract class BasePage {
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {}

  get urlPattern(): RegExp {
    return parabankPagePattern(this.path);
  }

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }
}
