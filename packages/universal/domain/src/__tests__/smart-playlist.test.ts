import {
  SMART_PLAYLIST_SORTS,
  SMART_PLAYLIST_SORT_KEYS,
  SMART_PLAYLIST_VIDEO_FORMATS,
  type SmartPlaylistRules,
  dependsOnViewer,
} from '../smart-playlist';

const rules = (
  fields: SmartPlaylistRules['conditions'][number]['field'][]
): SmartPlaylistRules => ({
  match: 'all',
  conditions: fields.map((field) =>
    field === 'unwatched' ? { field } : { field: 'format', format: 'short' }
  ),
  sort: 'newest',
  limit: 10,
});

describe('domain: smart playlists', () => {
  it.each([
    {
      scenario: 'unwatched for a viewer',
      fields: ['unwatched' as const],
      viewer: 'u1',
      expected: true,
    },
    {
      scenario: 'unwatched for a guest',
      fields: ['unwatched' as const],
      viewer: null,
      expected: false,
    },
    { scenario: 'no unwatched', fields: ['format' as const], viewer: 'u1', expected: false },
  ])('reads the viewer on $scenario: $expected', ({ fields, viewer, expected }) => {
    expect(dependsOnViewer(rules(fields), viewer)).toBe(expected);
  });

  it('keys every sort on a column in one direction', () => {
    expect(SMART_PLAYLIST_SORTS.map((sort) => SMART_PLAYLIST_SORT_KEYS[sort])).toEqual([
      { key: 'createdAt', order: 'desc' },
      { key: 'createdAt', order: 'asc' },
      { key: 'views', order: 'desc' },
      { key: 'duration', order: 'asc' },
      { key: 'duration', order: 'desc' },
    ]);
  });

  it('reads long as a standard video and short as a Short', () => {
    expect(SMART_PLAYLIST_VIDEO_FORMATS).toEqual({ long: 'standard', short: 'short' });
  });
});
