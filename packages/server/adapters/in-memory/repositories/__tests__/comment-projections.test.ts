import type { Channel } from '@vp/domain';
import { newStoredComment, toAuthoredCommentOf, toThreadOf } from '../comment-projections';
import type { StoredComment } from '../comment-visibility';
import { UNMODERATED } from './stored-comment';

const stored: StoredComment = {
  id: 'c1',
  parentId: 'root',
  videoId: 'v1',
  authorId: 'u1',
  content: 'hello',
  isPinned: false,
  isEdited: false,
  likeCount: 3,
  heartedAt: null,
  createdAt: new Date(10),
  updatedAt: new Date(20),
  deletedAt: null,
  ...UNMODERATED,
};

const channel = {
  id: 'ch1',
  handle: 'ann',
  displayName: 'Ann',
  avatarUrl: null,
} as Channel;

describe('adapters/in-memory: comment projections', () => {
  it.each([
    {
      scenario: 'an author with a channel',
      channel,
      author: {
        userId: 'u1',
        channelId: 'ch1',
        handle: 'ann',
        displayName: 'Ann',
        avatarUrl: null,
      },
    },
    {
      scenario: 'an author without a channel',
      channel: null,
      author: { userId: 'u1', channelId: null, handle: null, displayName: null, avatarUrl: null },
    },
  ])('shapes a thread for $scenario and drops the removal stamp', ({ channel, author }) => {
    const thread = toThreadOf(stored, channel, 2);

    expect(thread).toMatchObject({ id: 'c1', author, replyCount: 2 });
    expect(thread).not.toHaveProperty('deletedAt');
  });

  it.each([
    { title: 'Clip', expected: 'Clip' },
    { title: null, expected: '' },
  ])('shapes an authored comment under a video titled $title', ({ title, expected }) => {
    expect(toAuthoredCommentOf(stored, { id: 'v1', title })).toEqual({
      id: 'c1',
      content: 'hello',
      createdAt: stored.createdAt,
      parentId: 'root',
      likeCount: 3,
      video: { id: 'v1', title: expected },
    });
  });

  describe('newStoredComment', () => {
    const input = { id: 'c9', videoId: 'v1', authorId: 'u1', parentId: null, content: 'hi' };
    const now = new Date(5);

    it('starts a comment published, unmoderated and unliked', () => {
      expect(newStoredComment(input, now)).toEqual({
        ...input,
        ...UNMODERATED,
        isPinned: false,
        isEdited: false,
        likeCount: 0,
        heartedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    });

    it('stores what the gate decided and nothing a moderator has yet set', () => {
      const held = newStoredComment(
        {
          ...input,
          moderation: {
            moderationState: 'held',
            moderationDisclosure: 'visible',
            heldReason: 'link',
            looksLikeQuestion: true,
          },
        },
        now
      );

      expect(held).toMatchObject({
        moderationState: 'held',
        moderationDisclosure: 'visible',
        heldReason: 'link',
        looksLikeQuestion: true,
        moderatedBy: null,
        moderatedAt: null,
        moderationReason: null,
      });
      expect(held).not.toHaveProperty('moderation');
    });
  });
});
