import type { CommentThread } from '@vp/domain';
import { withOwnComments } from '../comment-own-overlay';

const thread = (id: string, at: number, parentId: string | null = null, replyCount = 0) =>
  ({
    id,
    parentId,
    createdAt: new Date(at),
    likeCount: 0,
    isPinned: false,
    replyCount,
  }) as CommentThread;

const PAGE = { threads: [thread('b', 20, null, 1), thread('a', 10)], total: 5 };

describe('apps/server/api/services: own comments on a page', () => {
  it('merges the author roots into a shared page in its order and counts them', () => {
    const merged = withOwnComments(PAGE, [thread('mine', 15)], 'newest', true);

    expect(merged.threads.map(({ id }) => id)).toEqual(['b', 'mine', 'a']);
    expect(merged.total).toBe(6);
  });

  it('counts the author replies on the public root they answer, not on a root of theirs', () => {
    const own = [thread('r1', 21, 'b'), thread('mine', 15), thread('r2', 22, 'mine')];

    const merged = withOwnComments(PAGE, own, 'newest', true);

    expect(merged.threads.map(({ id, replyCount }) => [id, replyCount])).toEqual([
      ['b', 2],
      ['mine', 0],
      ['a', 0],
    ]);
    expect(merged.total).toBe(8);
  });

  it('only moves the total of a page the author read as themselves', () => {
    const merged = withOwnComments(PAGE, [thread('mine', 15)], 'newest', false);

    expect(merged).toEqual({ threads: PAGE.threads, total: 6 });
  });
});
