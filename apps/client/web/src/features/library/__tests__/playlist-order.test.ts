import { moveToEdge, type PlaylistEdge } from '../playlist-order';

describe('apps/client/web: moveToEdge', () => {
  it.each<{ edge: PlaylistEdge; id: string; order: string[] }>([
    { edge: 'top', id: 'c', order: ['c', 'a', 'b'] },
    { edge: 'bottom', id: 'a', order: ['b', 'c', 'a'] },
    { edge: 'top', id: 'a', order: ['a', 'b', 'c'] },
    { edge: 'bottom', id: 'c', order: ['a', 'b', 'c'] },
  ])('moves $id to the $edge of a, b, c', ({ edge, id, order }) => {
    expect(moveToEdge(['a', 'b', 'c'], id, edge)).toEqual(order);
  });
});
