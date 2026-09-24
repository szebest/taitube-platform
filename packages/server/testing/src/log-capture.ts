import { Writable } from 'node:stream';

export type LogLine = Record<string, unknown>;

export interface LogCapture {
  /** Hand it to `createLogger` as its `destination`. */
  destination: Writable;
  lines: () => LogLine[];
  text: () => string;
}

/** Collects what a pino logger writes, one parsed JSON object per line. */
export function captureLog(): LogCapture {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    },
  });
  const text = () => chunks.join('');
  const lines = () =>
    text()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogLine);
  return { destination, lines, text };
}
