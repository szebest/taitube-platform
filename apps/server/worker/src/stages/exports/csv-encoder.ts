import type { ExportEncoder } from './export-encoder';

const FORMULA_START = /^[=+\-@\t]/;
const NEEDS_QUOTES = /[",\r\n]/;
const LIST_SEPARATOR = '|';

/**
 * A spreadsheet runs a cell that starts with `=`, `+`, `-`, `@` or a tab as a formula, and a comment
 * is text anyone can write, so such a text cell gets a leading apostrophe. Numbers are left alone.
 */
function textCell(text: string): string {
  const guarded = FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return textCell(value.map(String).join(LIST_SEPARATOR));
  if (typeof value === 'string') return textCell(value);
  return String(value);
}

/** RFC 4180: a header of the column names, then one CRLF-ended record per row in the same order. */
export function csvEncoder(columns: readonly string[]): ExportEncoder {
  const line = (cells: readonly unknown[]) => `${cells.map(csvCell).join(',')}\r\n`;
  return {
    start: line(columns),
    row: (row) => line(columns.map((column) => row[column])),
    end: '',
  };
}
