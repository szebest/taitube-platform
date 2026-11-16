import type { ExportEncoder } from './export-encoder';

/** One JSON array of the rows, written a row at a time so it never has to be held whole. */
export function jsonEncoder(): ExportEncoder {
  let rows = 0;
  return {
    start: '[',
    row: (row) => `${rows++ === 0 ? '' : ','}\n${JSON.stringify(row)}`,
    end: '\n]\n',
  };
}
