import type { NewUserEventInput } from '@vp/core/repositories';
import type { CommentThread, NewCommentInput } from '@vp/domain';
import { ok } from '@vp/result';
import { announceCreated } from '../comment-announce';
import { UNMODERATED } from './stored-comment';

const AUTHOR = 'author';
const OWNER = 'owner';
const MODERATOR = 'moderator';

const created: CommentThread = {
  id: 'c1',
  videoId: 'v1',
  authorId: AUTHOR,
  parentId: null,
  content: 'hi',
  isPinned: false,
  isEdited: false,
  likeCount: 0,
  heartedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...UNMODERATED,
  author: { userId: AUTHOR, channelId: null, handle: null, displayName: null, avatarUrl: null },
  replyCount: 0,
};

const video = { id: 'v1', ownerId: OWNER, title: 'Clip' };

const held: NewCommentInput['moderation'] = {
  moderationState: 'held',
  moderationDisclosure: 'silent',
  heldReason: 'review_all',
  looksLikeQuestion: false,
};

describe('adapters/in-memory: announce a created comment', () => {
  const told: NewUserEventInput[] = [];
  const events = {
    append: async (event: NewUserEventInput) => {
      told.push(event);
      return ok({ ...event, id: told.length, createdAt: new Date(0) });
    },
  };

  beforeEach(() => {
    told.length = 0;
  });

  it.each([
    {
      scenario: 'a public comment tells the video owner',
      counted: true,
      input: { authorId: AUTHOR },
      expected: [[OWNER, 'comment.created']],
    },
    {
      scenario: 'the owner is not told of their own comment',
      counted: true,
      input: { authorId: OWNER },
      expected: [],
    },
    {
      scenario: 'a held comment tells each moderator but its author',
      counted: false,
      input: { authorId: AUTHOR, moderation: held, moderators: [OWNER, MODERATOR, AUTHOR] },
      expected: [
        [OWNER, 'comment.held'],
        [MODERATOR, 'comment.held'],
      ],
    },
    {
      scenario: 'a shadowed comment tells no one',
      counted: false,
      input: { authorId: AUTHOR, moderators: [OWNER] },
      expected: [],
    },
  ])('$scenario', async ({ counted, input, expected }) => {
    await announceCreated(events, { created, video, input, counted });

    expect(told.map(({ userId, type }) => [userId, type])).toEqual(expected);
  });
});
