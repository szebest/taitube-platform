import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { CREDENTIAL_HEADERS, REDACTED } from './credentials';
import type { LogContext } from './log-context';
import { prettyDestination } from './pretty-destination';
import { serializeError } from './serialize-error';

/** `json` for a deployable's collector, `pretty` for a person at a terminal. */
export type LogFormat = 'json' | 'pretty';

export interface LoggerConfig {
  service: string;
  level: string;
  format: LogFormat;
  bindings?: Record<string, unknown>;
  /** Standard output for `json`, standard error for `pretty`; a spec hands a stream it reads back. */
  destination?: DestinationStream & NodeJS.WritableStream;
  context?: LogContext;
}

/** Wherever a headers object is logged: a request, a bare `headers`, or an error that kept one. */
const REDACTED_PATHS = [...CREDENTIAL_HEADERS].flatMap((header) => [
  `headers["${header}"]`,
  `*.headers["${header}"]`,
]);

function jsonOptions(config: LoggerConfig): LoggerOptions {
  const { context } = config;
  return {
    level: config.level,
    base: { service: config.service, ...config.bindings },
    redact: { paths: REDACTED_PATHS, censor: REDACTED },
    serializers: { err: serializeError },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
      const bindings = context?.current() ?? {};
      const spanContext = trace.getActiveSpan()?.spanContext();
      if (!(spanContext && isSpanContextValid(spanContext))) return { ...bindings };
      return { ...bindings, traceId: spanContext.traceId, spanId: spanContext.spanId };
    },
  };
}

function prettyOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.level,
    base: config.bindings ?? {},
    redact: { paths: REDACTED_PATHS, censor: REDACTED },
    serializers: { err: serializeError },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: false,
  };
}

export function createLogger(config: LoggerConfig): Logger {
  if (config.format === 'pretty') {
    const target = config.destination ?? process.stderr;
    return pino(prettyOptions(config), prettyDestination(target));
  }
  const options = jsonOptions(config);
  return config.destination ? pino(options, config.destination) : pino(options);
}

export type { Logger };
