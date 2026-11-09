import type { StoredComment } from '../comment-visibility';
import { repliesOf, standing } from '../comment-visibility';

const comment = (id: string, parentId: string | null, deletedAt: Date | null): StoredComment => ({
  id,
  parentId,
  deletedAt,
  videoId: 'v',
  authorId: 'a',
  content: '',
  isPinned: false,
  isEdited: false,
  likeCount: 0,
  heartedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const root = comment('root', null, null);
const reply = comment('reply', 'root', null);
const removedReply = comment('gone', 'root', new Date(1));
const all = [root, reply, removedReply];

describe('adapters/in-memory: comment visibility', () => {
  it('keeps the comments that were not removed', () => {
    expect(standing(all).map(({ id }) => id)).toEqual(['root', 'reply']);
  });

  it.each([
    { rootId: 'root', ids: ['reply'] },
    { rootId: 'reply', ids: [] },
  ])('lists the standing replies of $rootId', ({ rootId, ids }) => {
    expect(repliesOf(all, rootId).map(({ id }) => id)).toEqual(ids);
  });
});
