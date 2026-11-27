import { importPlaylist, mergePlaylists, transferPlaylistItems } from '../playlist-transfer';

const ID = '00000000-0000-7000-8000-00000000af01';

describe('packages/api-contracts: playlist transfer', () => {
  it.each([
    { body: { sourceIds: [ID], into: ID }, valid: true },
    { body: { sourceIds: [ID], newTitle: 'Both' }, valid: true },
    { body: { sourceIds: [ID], into: ID, newTitle: 'Both' }, valid: false },
    { body: { sourceIds: [ID] }, valid: false },
    { body: { sourceIds: Array(6).fill(ID), into: ID }, valid: false },
  ])('takes the merge $body: $valid', ({ body, valid }) => {
    expect(mergePlaylists.body.safeParse(body).success).toBe(valid);
  });

  it('moves at most 100 items at once', () => {
    const body = (count: number) => ({ itemIds: Array(count).fill(ID), to: ID, mode: 'move' });

    expect(
      [100, 101].map((count) => transferPlaylistItems.body.safeParse(body(count)).success)
    ).toEqual([true, false]);
  });

  it('refuses an import format it cannot read', () => {
    expect(importPlaylist.body.safeParse({ format: 'xml', content: '' }).success).toBe(false);
  });
});
