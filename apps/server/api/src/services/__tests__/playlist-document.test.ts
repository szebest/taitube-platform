import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { type ExportRow, readDocument, writeDocument } from '../playlist-document';

const ROWS: ExportRow[] = [
  {
    videoId: '00000000-0000-7000-8000-00000000d001',
    url: 'http://web.test/watch/00000000-0000-7000-8000-00000000d001',
    title: 'Opening, "live"',
    channel: 'Night Kitchen',
    note: '=HYPERLINK("http://evil.test")',
    startMs: 130_000,
    endMs: null,
  },
  {
    videoId: '00000000-0000-7000-8000-00000000d002',
    url: 'http://web.test/watch/00000000-0000-7000-8000-00000000d002',
    title: '@Closing',
    channel: '',
    note: null,
    startMs: null,
    endMs: null,
  },
];

describe('apps/server/api/services: playlist documents', () => {
  it.each(['json', 'csv'] as const)('reads a %s export back as the lines it wrote', (format) => {
    const lines = expectOk(readDocument(format, writeDocument(format, 'Mix', ROWS)));

    expect(lines).toEqual([
      { reference: ROWS[0]?.videoId, note: ROWS[0]?.note, startMs: 130_000, endMs: null },
      { reference: ROWS[1]?.videoId, note: null, startMs: null, endMs: null },
    ]);
  });

  it('writes a CSV cell that opens like a formula as text', () => {
    const csv = writeDocument('csv', 'Mix', ROWS);

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"")"`);
    expect(csv).toContain(",'@Closing,");
  });

  it('reads a URL list a line per non-blank line, and a malformed JSON entry as an empty reference', () => {
    expect(expectOk(readDocument('urls', 'a\n\n  b  \r\n')).map((line) => line.reference)).toEqual([
      'a',
      'b',
    ]);
    expect(expectOk(readDocument('json', '{"items":[42]}'))).toEqual([
      { reference: '', note: null, startMs: null, endMs: null },
    ]);
  });

  it.each([
    { scenario: 'text that is not JSON', format: 'json' as const, content: '{' },
    { scenario: 'JSON without items', format: 'json' as const, content: '{}' },
    { scenario: 'CSV with unbalanced quotes', format: 'csv' as const, content: 'videoId\n"open' },
    { scenario: 'more than 500 lines', format: 'urls' as const, content: 'x\n'.repeat(501) },
  ])('refuses $scenario', ({ format, content }) => {
    expect(expectErr(readDocument(format, content))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'content',
    });
  });
});
