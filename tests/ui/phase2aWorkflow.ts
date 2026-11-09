import type { Page } from '@playwright/test';
import { AccountDetailsPage, type AccountDetails } from '../../pages/accountDetailsPage';
import { LoginPage } from '../../pages/loginPage';
import { OpenAccountPage } from '../../pages/openAccountPage';
import { OverviewPage } from '../../pages/overviewPage';
import { RegisterPage } from '../../pages/registerPage';
import type { AppConfig } from '../../config/env';
import type { Logger } from '../../utils/logger';
import type { TestUser } from '../../test-data/userFactory';

const DUPLICATE_USERNAME_MESSAGE = /this username already exists/i;
const REGISTRATION_ATTEMPTS = 3;

export interface CheckingWorkflowResult {
  fundingAccountId: string;
  checkingAccountId: string;
  checkingAccount: AccountDetails;
}

export interface RegistrationResult {
  page: RegisterPage;
  user: TestUser;
}

export function registrationUser(appConfig: AppConfig, generatedUser: TestUser): TestUser {
  const user = appConfig.registrationMode === 'manual' ? appConfig.manualUser : generatedUser;
  if (user === undefined) {
    throw new Error('Manual registration mode did not provide a complete registration user.');
  }
  return user;
}

export async function registerCustomer(
  page: Page,
  initialUser: TestUser,
  log: Logger,
  nextUser?: () => TestUser,
): Promise<RegistrationResult> {
  let user = initialUser;
  for (let attempt = 1; attempt <= REGISTRATION_ATTEMPTS; attempt += 1) {
    const registrationPage = new RegisterPage(page);
    const submission = await registrationPage.register(user);
    log.info('Registration submission observed', {
      attempt,
      requestMethod: submission.requestMethod,
      requestUrl: submission.requestUrl,
      submittedUsername: submission.submittedUsername,
      responseStatus: submission.responseStatus,
      responseMessage: submission.resultText.replace(/\s+/g, ' ').trim(),
    });
    const resultText = submission.resultText;
    if (/created successfully/i.test(resultText)) {
      log.info('Customer registered', { username: user.username });
      return { page: registrationPage, user };
    }

    if (!DUPLICATE_USERNAME_MESSAGE.test(resultText) || nextUser === undefined || attempt === REGISTRATION_ATTEMPTS) {
      throw new Error(`ParaBank registration failed: ${resultText.replace(/\s+/g, ' ').trim()}`);
    }
    user = nextUser();
  }

  throw new Error('ParaBank registration failed without a response.');
}

export async function loginAndOpenChecking(
  page: Page,
  user: TestUser,
  log: Logger,
): Promise<CheckingWorkflowResult> {
  await new LoginPage(page).login(user.username, user.password);
  const fundingAccountId = (await new OverviewPage(page).accountIds())[0];
  if (fundingAccountId === undefined) {
    throw new Error('ParaBank did not return a funding account after registration.');
  }

  const checkingAccountId = await new OpenAccountPage(page).openCheckingAccount(fundingAccountId);
  log.info('Checking account created', { accountId: checkingAccountId });
  const checkingAccount = await new AccountDetailsPage(page).read(checkingAccountId);
  return { fundingAccountId, checkingAccountId, checkingAccount };
}
