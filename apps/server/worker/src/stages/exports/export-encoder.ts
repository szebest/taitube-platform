/** One export file as text: what opens it, one chunk per row, and what closes it. */
export interface ExportEncoder {
  readonly start: string;
  row(row: Readonly<Record<string, unknown>>): string;
  readonly end: string;
}
