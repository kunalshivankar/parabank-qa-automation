import type { Page } from '@playwright/test';
import { BasePage } from './basePage';
import type { TestUser } from '../test-data/userFactory';

export interface RegistrationSubmission {
  requestMethod: string;
  requestUrl: string;
  submittedUsername: string;
  responseStatus: number;
  responseBody: string;
  resultText: string;
}

export class RegisterPage extends BasePage {
  protected readonly path = 'register.htm';

  readonly resultPanel = this.page.locator('#rightPanel');

  constructor(page: Page) {
    super(page);
  }

  async register(user: TestUser): Promise<RegistrationSubmission> {
    await this.open();
    await this.page.locator('[name="customer.firstName"]').fill(user.firstName);
    await this.page.locator('[name="customer.lastName"]').fill(user.lastName);
    await this.page.locator('[name="customer.address.street"]').fill(user.address);
    await this.page.locator('[name="customer.address.city"]').fill(user.city);
    await this.page.locator('[name="customer.address.state"]').fill(user.state);
    await this.page.locator('[name="customer.address.zipCode"]').fill(user.zipCode);
    await this.page.locator('[name="customer.phoneNumber"]').fill(user.phoneNumber);
    await this.page.locator('[name="customer.ssn"]').fill(user.ssn);
    await this.page.locator('[name="customer.username"]').fill(user.username);
    await this.page.locator('[name="customer.password"]').fill(user.password);
    await this.page.locator('[name="repeatedPassword"]').fill(user.password);
    const requestPromise = this.page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === 'POST' && url.pathname.endsWith('/register.htm');
    });
    const responsePromise = this.page.waitForResponse((response) => {
      const request = response.request();
      const url = new URL(request.url());
      return request.method() === 'POST' && url.pathname.endsWith('/register.htm');
    });
    await this.page.getByRole('button', { name: 'Register' }).click();
    const [request, response] = await Promise.all([requestPromise, responsePromise]);
    const postData = request.postData() ?? '';
    const submittedUsername = new URLSearchParams(postData).get('customer.username') ?? '';
    if (submittedUsername !== user.username) {
      throw new Error(
        `Registration submitted username mismatch: expected "${user.username}", received "${submittedUsername}".`,
      );
    }
    await this.resultPanel.waitFor({ state: 'visible' });
    return {
      requestMethod: request.method(),
      requestUrl: request.url(),
      submittedUsername,
      responseStatus: response.status(),
      responseBody: await response.text(),
      resultText: await this.resultPanel.innerText(),
    };
  }
}
