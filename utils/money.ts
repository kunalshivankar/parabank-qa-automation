export class MoneyParseError extends Error {
  constructor(input: string, reason: string) {
    super(`Cannot parse currency value "${input}": ${reason}`);
    this.name = 'MoneyParseError';
  }
}

const AMOUNT_PATTERN = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{1,2}))?$/;

/**
 * Converts a displayed currency string such as "$1,234.56", "-$5.00" or "($5.00)"
 * into integer cents. No floating-point arithmetic is involved.
 */
export function parseCurrencyToCents(input: string): number {
  let text = input.replace(/\s+/g, '');
  if (text === '') {
    throw new MoneyParseError(input, 'value is empty');
  }

  let negativeMarkers = 0;
  if (text.startsWith('(') && text.endsWith(')')) {
    negativeMarkers += 1;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negativeMarkers += 1;
    text = text.slice(1);
  }
  if (text.startsWith('$')) {
    text = text.slice(1);
  }
  if (text.startsWith('-')) {
    negativeMarkers += 1;
    text = text.slice(1);
  }
  if (negativeMarkers > 1) {
    throw new MoneyParseError(input, 'ambiguous sign');
  }
  const negative = negativeMarkers === 1;

  const match = AMOUNT_PATTERN.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    throw new MoneyParseError(input, 'unexpected format');
  }

  const whole = (match[1] ?? '0').replaceAll(',', '');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const cents = Number(whole) * 100 + Number(fraction);

  if (!Number.isSafeInteger(cents)) {
    throw new MoneyParseError(input, 'value exceeds the safe integer range');
  }
  return negative ? -cents : cents;
}

/**
 * Converts a numeric amount returned by an API (for example 1234.56) into integer cents.
 * Rejects values with more than two decimal places instead of silently rounding them.
 */
export function numberToCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new MoneyParseError(String(amount), 'value is not a finite number');
  }
  const scaled = amount * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new MoneyParseError(String(amount), 'more than two decimal places');
  }
  if (!Number.isSafeInteger(rounded)) {
    throw new MoneyParseError(String(amount), 'value exceeds the safe integer range');
  }
  return rounded;
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyParseError(String(value), 'cents must be a safe integer');
    }
    const next = total + value;
    if (!Number.isSafeInteger(next)) {
      throw new MoneyParseError(String(next), 'sum exceeds the safe integer range');
    }
    return next;
  }, 0);
}

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new MoneyParseError(String(cents), 'cents must be a safe integer');
  }
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.trunc(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 100).toString().padStart(2, '0');
  return `${sign}$${whole}.${fraction}`;
}
