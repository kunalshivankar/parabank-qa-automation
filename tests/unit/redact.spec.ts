import { expect, test } from '@playwright/test';
import { redact, redactText } from '../../utils/redact';

test.describe('redact', () => {
  test('masks sensitive keys at any depth without touching other values', () => {
    const input = {
      username: 'qa_user',
      password: 'secret',
      customer: { ssn: '123-45-6789', city: 'Nagpur' },
      headers: { Authorization: 'Bearer abc', 'Set-Cookie': 'JSESSIONID=1' },
      list: [{ repeatedPassword: 'secret' }],
    };

    expect(redact(input)).toEqual({
      username: '[REDACTED]',
      password: '[REDACTED]',
      customer: { ssn: '[REDACTED]', city: '[REDACTED]' },
      headers: { Authorization: '[REDACTED]', 'Set-Cookie': '[REDACTED]' },
      list: [{ repeatedPassword: '[REDACTED]' }],
    });
  });

  test('does not mutate the original object', () => {
    const input = { password: 'secret' };
    redact(input);
    expect(input.password).toBe('secret');
  });
});

test.describe('redactText', () => {
  test('masks JSON string values', () => {
    expect(redactText('{"username":"a","password":"hunter2"}')).toBe(
      '{"username":"[REDACTED]","password":"[REDACTED]"}',
    );
  });

  test('masks URL-encoded form fields', () => {
    const masked = redactText('customer.username=a&customer.password=hunter2&customer.ssn=123-45-6789&city=Pune');
    expect(masked).toBe(
      'customer.username=[REDACTED]&customer.password=[REDACTED]&customer.ssn=[REDACTED]&city=[REDACTED]',
    );
  });

  test('masks Playwright snapshots and HTML input values', () => {
    expect(redactText('- textbox [ref=e1]: Kunal\n<input name="customer.username" value="qa_user">')).toBe(
      '- textbox [ref=e1]: [REDACTED]\n<input name="customer.username" value="[REDACTED]">',
    );
  });

  test('leaves text without sensitive keys unchanged', () => {
    expect(redactText('{"balance":100.5}')).toBe('{"balance":100.5}');
  });
});
