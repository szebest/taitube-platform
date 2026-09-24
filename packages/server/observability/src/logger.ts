import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import type { LogContext } from './log-context';

export interface LoggerConfig {
  service: string;
  level: string;
  bindings?: Record<string, unknown>;
  /** Standard output when omitted; a spec hands a stream it reads back. */
  destination?: DestinationStream;
  context?: LogContext;
}

const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'x-admin-token'] as const;

/** Wherever a headers object is logged: a request, a bare `headers`, or an error that kept one. */
const REDACTED_PATHS: readonly string[] = CREDENTIAL_HEADERS.flatMap((header) => [
  `headers["${header}"]`,
  `*.headers["${header}"]`,
]);

export function createLogger(config: LoggerConfig): Logger {
  const { context } = config;
  const options: LoggerOptions = {
    level: config.level,
    base: { service: config.service, ...config.bindings },
    redact: { paths: [...REDACTED_PATHS], censor: '[Redacted]' },
    formatters: { level: (label) => ({ level: label }) },
    mixin() {
      const bindings = context?.current() ?? {};
      const spanContext = trace.getActiveSpan()?.spanContext();
      if (!(spanContext && isSpanContextValid(spanContext))) return { ...bindings };
      return { ...bindings, traceId: spanContext.traceId, spanId: spanContext.spanId };
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return config.destination ? pino(options, config.destination) : pino(options);
}

export type { Logger };
