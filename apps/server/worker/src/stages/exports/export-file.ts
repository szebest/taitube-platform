import { once } from 'node:events';
import { createWriteStream } from 'node:fs';

export interface ExportFile {
  /** Waits out backpressure, so the rows read ahead of the disk never pile up in memory. */
  write(chunk: string): Promise<void>;
  close(): Promise<void>;
  readonly bytes: number;
}

export function openExportFile(path: string): ExportFile {
  const stream = createWriteStream(path, { encoding: 'utf8' });
  let bytes = 0;
  return {
    async write(chunk) {
      bytes += Buffer.byteLength(chunk);
      if (!stream.write(chunk)) await once(stream, 'drain');
    },
    async close() {
      stream.end();
      await once(stream, 'finish');
    },
    get bytes() {
      return bytes;
    },
  };
}
