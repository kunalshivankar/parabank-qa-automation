import { expect, test } from '@playwright/test';
import {
  MoneyParseError,
  formatCents,
  numberToCents,
  parseCurrencyToCents,
  sumCents,
} from '../../utils/money';

test.describe('parseCurrencyToCents', () => {
  const validCases: Array<[string, number]> = [
    ['$150.00', 15000],
    ['$25.50', 2550],
    ['$8.99', 899],
    ['$1,234.56', 123456],
    ['$1,000,000.01', 100000001],
    ['$0.05', 5],
    ['$0.00', 0],
    ['$5', 500],
    ['5.5', 550],
    ['.50', 50],
    ['  $ 12.30 ', 1230],
    ['-$5.00', -500],
    ['$-5.00', -500],
    ['($5.00)', -500],
    ['-0.01', -1],
  ];

  for (const [input, expected] of validCases) {
    test(`parses "${input}" as ${expected} cents`, () => {
      expect(parseCurrencyToCents(input)).toBe(expected);
    });
  }

  const invalidCases: Array<[string, string]> = [
    ['', 'empty'],
    ['   ', 'whitespace only'],
    ['$', 'symbol only'],
    ['abc', 'letters'],
    ['$12.345', 'three decimal places'],
    ['$1,23,456.00', 'misplaced thousands separator'],
    ['$12.', 'trailing decimal point'],
    ['$1.2.3', 'two decimal points'],
    ['--5', 'double minus'],
    ['-$-5', 'sign on both sides of the currency symbol'],
    ['(-$5.00)', 'parentheses combined with a minus'],
    ['$5.00 USD', 'trailing text'],
    ['9999999999999999.99', 'beyond the safe integer range'],
  ];

  for (const [input, reason] of invalidCases) {
    test(`rejects "${input}" (${reason})`, () => {
      expect(() => parseCurrencyToCents(input)).toThrow(MoneyParseError);
    });
  }

  test('includes the offending input in the error message', () => {
    expect(() => parseCurrencyToCents('$12.345')).toThrow(/\$12\.345/);
  });
});

test.describe('numberToCents', () => {
  test('converts values that are not exactly representable in binary floating point', () => {
    expect(1.15 * 100).not.toBe(115);
    expect(numberToCents(1.15)).toBe(115);
    expect(numberToCents(8.99)).toBe(899);
    expect(numberToCents(1234.56)).toBe(123456);
    expect(numberToCents(-25.5)).toBe(-2550);
    expect(numberToCents(0)).toBe(0);
  });

  test('rejects values with more than two decimal places instead of rounding them', () => {
    expect(() => numberToCents(1.005)).toThrow(MoneyParseError);
  });

  test('rejects non-finite values', () => {
    expect(() => numberToCents(Number.NaN)).toThrow(MoneyParseError);
    expect(() => numberToCents(Number.POSITIVE_INFINITY)).toThrow(MoneyParseError);
  });
});

test.describe('sumCents and formatCents', () => {
  test('floating-point addition of dollar amounts is not reliable', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  test('sums the Scenario B transfer amounts exactly', () => {
    const transfers = ['$150.00', '$25.50', '$8.99'].map(parseCurrencyToCents);
    const total = sumCents(transfers);
    expect(total).toBe(18449);
    expect(formatCents(total)).toBe('$184.49');
  });

  test('sums an empty list to zero', () => {
    expect(sumCents([])).toBe(0);
  });

  test('rejects fractional cents', () => {
    expect(() => sumCents([100, 0.5])).toThrow(MoneyParseError);
  });

  test('formats cents with grouping and sign', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(100000001)).toBe('$1,000,000.01');
    expect(formatCents(-2550)).toBe('-$25.50');
  });

  test('round-trips through parse and format', () => {
    for (const cents of [0, 1, 99, 100, 101, 123456, 99999999, -1, -123456]) {
      expect(parseCurrencyToCents(formatCents(cents))).toBe(cents);
    }
  });
});
