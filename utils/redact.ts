const SENSITIVE_KEYS = [
  'username',
  'firstname',
  'lastname',
  'address',
  'street',
  'city',
  'state',
  'zipcode',
  'phonenumber',
  'password',
  'repeatedpassword',
  'confirm',
  'ssn',
  'authorization',
  'cookie',
  'set-cookie',
  'token',
];

const MASK = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z-]/g, '');
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

export function redact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redact(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = isSensitiveKey(key) ? MASK : redact(entry);
    }
    return result as T;
  }
  return value;
}

/**
 * Masks sensitive key/value pairs inside free text such as JSON bodies or URL-encoded forms.
 */
export function redactText(text: string): string {
  const pattern = new RegExp(
    `("?[\\w.\\[\\]-]*(?:${SENSITIVE_KEYS.join('|')})[\\w.\\[\\]-]*"?\\s*[:=]\\s*)("[^"]*"|[^&\\s,}]+)`,
    'gi',
  );
  const redactedKeyValues = text.replace(pattern, (_match, prefix: string, rawValue: string) => {
    const quoted = rawValue.startsWith('"');
    return `${prefix}${quoted ? `"${MASK}"` : MASK}`;
  });

  // Playwright error-context snapshots and HTML response bodies can expose
  // field values without a key/value delimiter. Mask those values as well.
  return redactedKeyValues
    .replace(/(\btextbox\s+\[[^\]]+\]\s*:\s*)[^\r\n]*/gi, `$1${MASK}`)
    .replace(/(<input\b[^>]*\bvalue\s*=\s*["'])([^"']*)(["'])/gi, `$1${MASK}$3`);
}
