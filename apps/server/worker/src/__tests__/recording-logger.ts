import type { Logger } from '@kit/logger';

export interface LogLine {
  readonly level: string;
  readonly message: string;
}

export function recordingLogger(lines: LogLine[]): Logger {
  const at = (level: string) => (_fields: unknown, message?: string) => {
    lines.push({ level, message: message ?? '' });
  };
  const logger = {
    fatal: at('fatal'),
    error: at('error'),
    warn: at('warn'),
    info: at('info'),
    debug: at('debug'),
    trace: at('trace'),
    child: () => logger,
  };
  return logger as unknown as Logger;
}
