import pino, { type Logger, type LoggerOptions } from 'pino';

export interface LoggerConfig {
  service: string;
  level?: string;
  bindings?: Record<string, unknown>;
}

export function createLogger(config: LoggerConfig): Logger {
  const level =
    config.level || process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

  const options: LoggerOptions = {
    level,
    base: {
      service: config.service,
      ...config.bindings,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return pino(options);
}

export type { Logger };
