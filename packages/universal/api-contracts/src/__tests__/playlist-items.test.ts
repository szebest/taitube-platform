import { editPlaylistItem, listPlaylistItems, sortPlaylist } from '../playlist-items';

describe('packages/api-contracts: playlist items', () => {
  it('reads the manual order when no sort is asked for', () => {
    expect(listPlaylistItems.query.parse({})).toMatchObject({ sort: 'manual' });
  });

  it.each([
    { body: { note: 'x' }, valid: true },
    { body: { startMs: null, endMs: 1000 }, valid: true },
    { body: {}, valid: false },
    { body: { videoId: 'x' }, valid: false },
    { body: { startMs: -1 }, valid: false },
  ])('takes the edit $body: $valid', ({ body, valid }) => {
    expect(editPlaylistItem.body.safeParse(body).success).toBe(valid);
  });

  it('refuses to write the manual order back', () => {
    expect(sortPlaylist.body.safeParse({ sort: 'manual' }).success).toBe(false);
  });
});
