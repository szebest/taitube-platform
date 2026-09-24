import { Writable } from 'node:stream';
import type { SerializedError } from './serialize-error';

interface LogRecord {
  level: string;
  msg?: string;
  err?: SerializedError;
  [field: string]: unknown;
}

/** What pino puts on every line, which a person reading a terminal does not need to see. */
const HIDDEN_FIELDS = new Set(['level', 'time', 'msg', 'service', 'err', 'pid', 'hostname']);

function describeError(err: SerializedError): string {
  const lines: string[] = [];
  let current: SerializedError | undefined = err;
  let prefix = '';
  while (current) {
    const code = current.code ? ` [${current.code}]` : '';
    lines.push(`  ${prefix}${current.type}${code}: ${current.message}`);
    prefix = 'caused by ';
    current = current.cause;
  }
  return lines.join('\n');
}

function describeFields(record: LogRecord): string {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    fields.push(`${key}=${text}`);
  }
  return fields.join(' ');
}

/** One JSON line from pino as `level message key=value`, then the error and its causes. */
export function prettyLine(json: string): string {
  const record: LogRecord = JSON.parse(json);
  const parts = [record.level, record.msg ?? '', describeFields(record)];
  const lines = [parts.filter(Boolean).join(' ')];
  if (record.err) lines.push(describeError(record.err));
  return `${lines.join('\n')}\n`;
}

/** A pino destination that writes each record through `prettyLine` to `target`. */
export function prettyDestination(target: NodeJS.WritableStream): Writable {
  return new Writable({
    write(chunk, _encoding, done) {
      const records = String(chunk).split('\n').filter(Boolean);
      for (const record of records) target.write(prettyLine(record));
      done();
    },
  });
}
