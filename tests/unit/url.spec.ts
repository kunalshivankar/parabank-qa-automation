import { expect, test } from '@playwright/test';
import { parabankPagePattern } from '../../utils/url';

test.describe('parabankPagePattern', () => {
  const pattern = parabankPagePattern('register.htm');

  const matching = [
    'https://parabank.parasoft.com/parabank/register.htm',
    'https://parabank.parasoft.com/parabank/register.htm;jsessionid=799495290416025AFB10A6F9B7F8EC3F',
    'https://parabank.parasoft.com/parabank/register.htm?x=1',
    'https://parabank.parasoft.com/parabank/register.htm;jsessionid=ABC?x=1#top',
  ];
  for (const url of matching) {
    test(`matches ${url}`, () => {
      expect(url).toMatch(pattern);
    });
  }

  const notMatching = [
    'https://parabank.parasoft.com/parabank/registerXhtm',
    'https://parabank.parasoft.com/parabank/register.html',
    'https://parabank.parasoft.com/parabank/overview.htm',
    'https://parabank.parasoft.com/parabank/xregister.htm',
  ];
  for (const url of notMatching) {
    test(`does not match ${url}`, () => {
      expect(url).not.toMatch(pattern);
    });
  }
});
