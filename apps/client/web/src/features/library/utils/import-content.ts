import { PLAYLIST_IMPORT_MAX_BYTES, PLAYLIST_IMPORT_MAX_LINES } from '@vp/domain';

export type ImportFormat = 'json' | 'csv' | 'urls';

/** Whether pasted or picked text may be sent: the limits the API holds, checked before it travels. */
export type ImportCheck =
  | { kind: 'ready' }
  | { kind: 'empty' }
  | { kind: 'tooLarge'; bytes: number }
  | { kind: 'tooManyLines'; lines: number };

const EXTENSIONS: Record<string, ImportFormat> = { json: 'json', csv: 'csv', txt: 'urls' };

/**
 * A JSON document counts its entries, which only the API reads, so only its size is checked here;
 * CSV and a list of links count their non-blank lines, a CSV header included.
 */
export function checkImportContent(content: string, format: ImportFormat): ImportCheck {
  if (content.trim() === '') return { kind: 'empty' };

  const bytes = new TextEncoder().encode(content).byteLength;
  if (bytes > PLAYLIST_IMPORT_MAX_BYTES) return { kind: 'tooLarge', bytes };
  if (format === 'json') return { kind: 'ready' };

  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '').length;
  const allowed = format === 'csv' ? PLAYLIST_IMPORT_MAX_LINES + 1 : PLAYLIST_IMPORT_MAX_LINES;
  return lines > allowed ? { kind: 'tooManyLines', lines } : { kind: 'ready' };
}

/** The format a picked file's extension names; a `.txt` file is a list of links. */
export function importFormatOf(fileName: string): ImportFormat | null {
  const extension = fileName.split('.').at(-1)?.toLowerCase() ?? '';
  return fileName.includes('.') ? (EXTENSIONS[extension] ?? null) : null;
}
