import {
  COMMENT_SORTS,
  type CommentSort,
  type CommentThread,
  CREATOR_INBOX_FILTERS,
  compareThreads,
  threadRootId,
} from '../comment';

const thread = (id: string, at: number, likeCount: number, isPinned = false) =>
  ({ id, createdAt: new Date(at), likeCount, isPinned }) as CommentThread;

describe('domain: comment threads', () => {
  it.each([
    { scenario: 'a root comment is its own thread', parentId: null, expected: 'c-1' },
    { scenario: 'a reply belongs to its root', parentId: 'root-1', expected: 'root-1' },
  ])('$scenario', ({ parentId, expected }) => {
    expect(threadRootId({ id: 'c-1', parentId })).toBe(expected);
  });

  it('opens on top, the order a watch page ranks by', () => {
    expect(COMMENT_SORTS).toEqual(['top', 'newest']);
  });

  it('filters the creator inbox to everything, what is unanswered, reported, held, hidden or a question', () => {
    expect(CREATOR_INBOX_FILTERS).toEqual([
      'all',
      'unanswered',
      'reported',
      'held',
      'hidden',
      'questions',
      'restricted',
    ]);
  });

  it.each<{ sort: CommentSort; order: string[] }>([
    { sort: 'top', order: ['pinned', 'liked', 'newer', 'tie-b', 'tie-a', 'older'] },
    { sort: 'newest', order: ['pinned', 'newer', 'tie-b', 'tie-a', 'liked', 'older'] },
  ])('orders root comments by $sort', ({ sort, order }) => {
    const roots = [
      thread('older', 1, 0),
      thread('liked', 2, 9),
      thread('tie-a', 3, 0),
      thread('tie-b', 3, 0),
      thread('newer', 4, 0),
      thread('pinned', 0, 0, true),
    ];

    expect(roots.sort(compareThreads(sort)).map(({ id }) => id)).toEqual(order);
  });
});
