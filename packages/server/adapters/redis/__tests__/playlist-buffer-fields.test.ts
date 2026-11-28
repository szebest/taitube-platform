import { playlistEventField, playlistField, playlistsFromBuffer } from '../playlist-buffer-fields';
import {
  countsFromBuffer,
  devicesFromBuffer,
  shareLinksFromBuffer,
  viewBufferField,
} from '../view-buffer-fields';

const VIDEO = '00000000-0000-7000-8000-00000000000a';
const OTHER = '00000000-0000-7000-8000-00000000000b';
const LIST = '00000000-0000-7000-8000-0000000001a1';

describe('playlist buffer fields', () => {
  it.each([
    {
      event: { measure: 'plays', playlistId: LIST, videoId: VIDEO },
      field: `${LIST}|2026-03-10|plays|pl:${VIDEO}`,
    },
    { event: { measure: 'forks', playlistId: LIST }, field: `${LIST}|2026-03-10|forks|pl:` },
  ] as const)('names the field of a $event.measure event', ({ event, field }) => {
    expect(playlistEventField({ ...event, viewDate: '2026-03-10' })).toBe(field);
  });

  it('reads the playlist fields beside the video ones, which skip them', () => {
    const hash = {
      [playlistField(LIST, '2026-03-10', 'opens', null)]: '3',
      [playlistField(LIST, '2026-03-10', 'plays', VIDEO)]: '2',
      [playlistField(LIST, '2026-03-10', 'plays', OTHER)]: '1',
      [viewBufferField(VIDEO, '2026-03-10', 'views')]: '4',
    };

    expect(playlistsFromBuffer(hash)).toEqual([
      {
        playlistId: LIST,
        videoId: null,
        viewDate: '2026-03-10',
        opens: 3,
        plays: 0,
        follows: 0,
        forks: 0,
      },
      {
        playlistId: LIST,
        videoId: VIDEO,
        viewDate: '2026-03-10',
        opens: 0,
        plays: 2,
        follows: 0,
        forks: 0,
      },
      {
        playlistId: LIST,
        videoId: OTHER,
        viewDate: '2026-03-10',
        opens: 0,
        plays: 1,
        follows: 0,
        forks: 0,
      },
    ]);
    expect([countsFromBuffer(hash), devicesFromBuffer(hash), shareLinksFromBuffer(hash)]).toEqual([
      [{ videoId: VIDEO, viewDate: '2026-03-10', views: 4, watchSeconds: 0 }],
      [],
      [],
    ]);
  });

  it.each([
    ['a measure nobody counts', { [`${LIST}|2026-03-10|likes|pl:`]: '4' }],
    ['a field with extra parts', { [`${LIST}|2026-03-10|opens|pl:|x`]: '4' }],
    [
      'a count that is not a number',
      { [playlistField(LIST, '2026-03-10', 'forks', null)]: 'many' },
    ],
    ['a count of zero', { [playlistField(LIST, '2026-03-10', 'follows', null)]: '0' }],
  ])('reads %s as no playlist count', (_name, hash) => {
    expect(playlistsFromBuffer(hash)).toEqual([]);
  });
});
