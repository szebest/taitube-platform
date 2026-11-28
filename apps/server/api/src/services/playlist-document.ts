import {
  type Result,
  andThen,
  assertNever,
  err,
  isErr,
  ok,
  parseJson,
  tryCatch,
} from '@kit/result';
import { PLAYLIST_IMPORT_MAX_LINES, type PlaylistEntry } from '@vp/domain';
import { type InvalidField, invalidField } from '@vp/validation';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';

export type PlaylistDocumentFormat = 'json' | 'csv';
export type PlaylistImportFormat = PlaylistDocumentFormat | 'urls';

const COLUMNS = ['videoId', 'url', 'title', 'channel', 'note', 'startMs', 'endMs'] as const;

const MsSchema = z.coerce.number<unknown>().int().nonnegative();

/** A blank CSV cell is an absent value, so `videoId,,` reads like `{ videoId }`. */
const blank = (value: unknown) => (value === '' ? undefined : value);

const LineSchema = z.object({
  videoId: z.preprocess(blank, z.string().optional()),
  url: z.preprocess(blank, z.string().optional()),
  note: z.preprocess(blank, z.string().nullable().optional()),
  startMs: z.preprocess(blank, MsSchema.nullable().optional()),
  endMs: z.preprocess(blank, MsSchema.nullable().optional()),
});

const DocumentSchema = z.object({ items: z.array(z.unknown()) });

/** The quote `escape_formulas` puts before a cell a spreadsheet would run as a formula. */
const ESCAPED_FORMULA = /^'[=+\-@\t\r]/;

const unescapeFormula = (value: string) => (ESCAPED_FORMULA.test(value) ? value.slice(1) : value);

/** One entry of an import: what names its video, and the note and segment it brings along. */
export interface ImportLine {
  reference: string;
  note: string | null;
  startMs: number | null;
  endMs: number | null;
}

export interface ExportRow {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  note: string | null;
  startMs: number | null;
  endMs: number | null;
}

export function exportRow(entry: PlaylistEntry, webUrl: string): ExportRow {
  const { videoId, video, channel, note, startMs, endMs } = entry;
  return {
    videoId,
    url: new URL(`/watch/${videoId}`, webUrl).href,
    title: video.title ?? '',
    channel: channel?.displayName ?? '',
    note,
    startMs,
    endMs,
  };
}

/** The document import takes back unchanged. */
export function writeDocument(
  format: PlaylistDocumentFormat,
  title: string,
  rows: readonly ExportRow[]
): string {
  if (format === 'json') return JSON.stringify({ title, items: rows }, null, 2);
  return stringify(
    rows.map((row) => COLUMNS.map((column) => row[column] ?? '')),
    { header: true, columns: [...COLUMNS], escape_formulas: true }
  );
}

function invalidDocument(message: string): InvalidField {
  return invalidField('content', message, {});
}

/** A malformed entry still counts as a line, unrecognised, so line numbers match the document. */
function toLine(raw: unknown): ImportLine {
  const parsed = LineSchema.safeParse(raw);
  if (!parsed.success) return { reference: '', note: null, startMs: null, endMs: null };
  const { videoId, url, note, startMs, endMs } = parsed.data;
  return {
    reference: videoId ?? url ?? '',
    note: note ?? null,
    startMs: startMs ?? null,
    endMs: endMs ?? null,
  };
}

function entriesOf(format: PlaylistImportFormat, content: string): Result<unknown[], InvalidField> {
  switch (format) {
    case 'urls':
      return ok(
        content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== '')
          .map((url) => ({ url }))
      );
    case 'json': {
      const parsed = parseJson(content);
      if (isErr(parsed)) return err(invalidDocument('The content is not JSON'));
      const document = DocumentSchema.safeParse(parsed.value);
      return document.success
        ? ok(document.data.items)
        : err(invalidDocument('A JSON import is an object with an items array'));
    }
    case 'csv':
      return tryCatch(
        (): unknown[] =>
          parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: unescapeFormula,
          }),
        () => invalidDocument('The content is not CSV with a header row')
      );
    default:
      return assertNever(format, 'PlaylistImportFormat');
  }
}

export function readDocument(
  format: PlaylistImportFormat,
  content: string
): Result<ImportLine[], InvalidField> {
  return andThen(entriesOf(format, content), (entries) =>
    entries.length > PLAYLIST_IMPORT_MAX_LINES
      ? err(invalidDocument(`An import holds at most ${PLAYLIST_IMPORT_MAX_LINES} lines`))
      : ok(entries.map(toLine))
  );
}
