import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en playlistEdit', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'playlistEdit.addedBy', args: { name: 'Marta' }, expected: 'Added by Marta' },
    {
      key: 'playlistEdit.segmentRange',
      args: { start: '0:30', end: '1:45' },
      expected: '0:30 to 1:45',
    },
    { key: 'playlistEdit.segmentFrom', args: { start: '0:30' }, expected: 'From 0:30' },
    {
      key: 'playlistEdit.sortMenu',
      args: { sort: 'unwatched_first' },
      expected: 'Sort: Unwatched first',
    },
    { key: 'playlistEdit.selectedCount', args: { count: 1200 }, expected: '1,200 selected' },
    {
      key: 'playlistEdit.sectionDialogTitle',
      args: { mode: 'rename' },
      expected: 'Rename section',
    },
    { key: 'playlistEdit.noteCount', args: { count: 12, max: 300 }, expected: '12 of 300' },
    {
      key: 'playlistEdit.transferBody',
      args: { count: 1 },
      expected: 'Pick where the selected video goes.',
    },
    {
      key: 'playlistEdit.transferBody',
      args: { count: 3 },
      expected: 'Pick where the 3 selected videos go.',
    },
    { key: 'playlistEdit.resultLanded', args: { mode: 'copy', count: 2 }, expected: 'Copied: 2' },
    {
      key: 'playlistEdit.refusedItem',
      args: { title: 'Tram ride', reason: 'FORBIDDEN' },
      expected: 'Tram ride: you may not move it',
    },
    { key: 'playlistEdit.mergeTarget', args: { target: 'new' }, expected: 'A new playlist' },
    {
      key: 'playlistEdit.importTooManyLines',
      args: { count: 501, max: 500 },
      expected: 'That has 501 lines; at most 500 go in at once',
    },
    {
      key: 'playlistEdit.importLine',
      args: { row: 1204, status: 'unrecognised' },
      expected: 'Line 1204: Not a video of this site',
    },
    { key: 'playlistEdit.exportAs', args: { format: 'csv' }, expected: 'Download CSV' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
