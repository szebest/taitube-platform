import { POSITION_GAP, type PlaylistReorder } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { decidePlaylistReorder } from '../reorder-playlist.rule';

const items = ['a', 'b', 'c'].map((id, index) => ({ id, position: index * POSITION_GAP }));

describe('@vp/domain-rules: decidePlaylistReorder', () => {
  it('moves one item by rewriting it alone', () => {
    const result = decidePlaylistReorder('p1', items, { type: 'move', itemId: 'c', index: 0 });

    expect(isOk(result) && result.value).toEqual([{ id: 'c', position: -POSITION_GAP }]);
  });

  it('respaces every item in the order a full reindex names', () => {
    const result = decidePlaylistReorder('p1', items, {
      type: 'reindex',
      itemIds: ['c', 'a', 'b'],
    });

    expect(isOk(result) && result.value).toEqual([
      { id: 'c', position: 0 },
      { id: 'a', position: POSITION_GAP },
      { id: 'b', position: 2 * POSITION_GAP },
    ]);
  });

  it('reports a move of an item the playlist does not hold', () => {
    const result = decidePlaylistReorder('p1', items, { type: 'move', itemId: 'x', index: 0 });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND,
      itemId: 'x',
    });
  });

  it.each<{ scenario: string; itemIds: string[] }>([
    { scenario: 'misses an item', itemIds: ['a', 'b'] },
    { scenario: 'names an item twice', itemIds: ['a', 'a', 'b'] },
    { scenario: 'names a stranger', itemIds: ['a', 'b', 'x'] },
  ])('refuses a reindex that $scenario as a stale view', ({ itemIds }) => {
    const change: PlaylistReorder = { type: 'reindex', itemIds };

    const result = decidePlaylistReorder('p1', items, change);

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VERSION_CONFLICT);
  });
});
