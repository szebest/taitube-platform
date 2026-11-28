import { PLAYLIST_IMPORT_MAX_BYTES, PLAYLIST_IMPORT_MAX_LINES } from '@vp/domain';
import { checkImportContent, type ImportFormat, importFormatOf } from '../import-content';

const linesOf = (count: number) => Array.from({ length: count }, (_, n) => `id-${n}`).join('\n');

describe('apps/client/web: checkImportContent', () => {
  it.each<{ input: string; format: ImportFormat; content: string; check: unknown }>([
    { input: 'blank text', format: 'urls', content: ' \n ', check: { kind: 'empty' } },
    {
      input: 'the most links allowed, blank lines aside',
      format: 'urls',
      content: `${linesOf(PLAYLIST_IMPORT_MAX_LINES)}\n\n`,
      check: { kind: 'ready' },
    },
    {
      input: 'one link too many',
      format: 'urls',
      content: linesOf(PLAYLIST_IMPORT_MAX_LINES + 1),
      check: { kind: 'tooManyLines', lines: PLAYLIST_IMPORT_MAX_LINES + 1 },
    },
    {
      input: 'a CSV of the most rows under its header',
      format: 'csv',
      content: linesOf(PLAYLIST_IMPORT_MAX_LINES + 1),
      check: { kind: 'ready' },
    },
    {
      input: 'a long JSON document, whose entries the API counts',
      format: 'json',
      content: linesOf(PLAYLIST_IMPORT_MAX_LINES * 2),
      check: { kind: 'ready' },
    },
    {
      input: 'text one UTF-8 byte over the limit',
      format: 'json',
      content: `${'a'.repeat(PLAYLIST_IMPORT_MAX_BYTES - 1)}é`,
      check: { kind: 'tooLarge', bytes: PLAYLIST_IMPORT_MAX_BYTES + 1 },
    },
  ])('checks $input', ({ content, format, check }) => {
    expect(checkImportContent(content, format)).toEqual(check);
  });
});

describe('apps/client/web: importFormatOf', () => {
  it.each([
    ['trips.json', 'json'],
    ['Trips.CSV', 'csv'],
    ['links.txt', 'urls'],
    ['notes.md', null],
    ['json', null],
  ])('reads %s as %s', (fileName, format) => {
    expect(importFormatOf(fileName)).toBe(format);
  });
});
