import { redact } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createLogger(scope: string, minLevel: LogLevel = 'info'): Logger {
  const write = (level: LogLevel, message: string, meta?: unknown): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
      return;
    }
    const timestamp = new Date().toISOString();
    const suffix = meta === undefined ? '' : ` ${JSON.stringify(redact(meta))}`;
    process.stderr.write(`${timestamp} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}${suffix}\n`);
  };

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}
