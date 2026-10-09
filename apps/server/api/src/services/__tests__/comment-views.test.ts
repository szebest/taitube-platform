import type { CommentThread } from '@vp/domain';
import { toCommentView } from '../comment-views';

const AT = new Date('2026-03-01T12:00:00.000Z');

const THREAD: CommentThread = {
  id: 'c-1',
  videoId: 'v-1',
  authorId: 'u-1',
  parentId: null,
  content: 'hello',
  isPinned: false,
  isEdited: true,
  likeCount: 3,
  createdAt: AT,
  updatedAt: AT,
  author: { userId: 'u-1', channelId: 'ch-1', handle: 'u1', displayName: 'U1', avatarUrl: null },
  replyCount: 1,
};

describe('apps/api/services: comment views', () => {
  it('renders dates as ISO strings and keeps the author under author', () => {
    expect(toCommentView(THREAD, 'owner-1')).toEqual({
      id: 'c-1',
      videoId: 'v-1',
      parentId: null,
      content: 'hello',
      isPinned: false,
      isEdited: true,
      likeCount: 3,
      replyCount: 1,
      author: {
        userId: 'u-1',
        channelId: 'ch-1',
        handle: 'u1',
        displayName: 'U1',
        avatarUrl: null,
        isCreator: false,
      },
      createdAt: AT.toISOString(),
      updatedAt: AT.toISOString(),
    });
  });

  it('badges the author who owns the video', () => {
    expect(toCommentView(THREAD, 'u-1').author.isCreator).toBe(true);
  });
});
