import { Writable } from 'node:stream';
import { prettyLine } from './pretty-line';

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
