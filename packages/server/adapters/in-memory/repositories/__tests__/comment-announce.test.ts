import { ok } from '@kit/result';
import type { NewOutboxInput, NewUserEventInput } from '@vp/core/repositories';
import type { CommentThread, NewCommentInput } from '@vp/domain';
import { announceCreated } from '../comment-announce';
import type { TargetOwner } from '../comment-targets';
import { UNMODERATED } from './stored-comment';

const AUTHOR = 'author';
const OWNER = 'owner';
const MODERATOR = 'moderator';

const created: CommentThread = {
  id: 'c1',
  target: { type: 'video', id: 'v1' },
  channelId: 'owner-channel',
  authorId: AUTHOR,
  authorChannelId: 'author-channel',
  parentId: null,
  content: 'hi',
  isPinned: false,
  isEdited: false,
  likeCount: 0,
  heartedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...UNMODERATED,
  author: {
    userId: AUTHOR,
    channelId: 'author-channel',
    handle: null,
    displayName: null,
    avatarUrl: null,
  },
  replyCount: 0,
};

const owner: TargetOwner = { type: 'video', id: 'v1', ownerId: OWNER, title: 'Clip' };

const held: NewCommentInput['moderation'] = {
  moderationState: 'held',
  moderationDisclosure: 'silent',
  heldReason: 'review_all',
  looksLikeQuestion: false,
};

describe('adapters/in-memory: announce a created comment', () => {
  const told: NewUserEventInput[] = [];
  const queued: NewOutboxInput[] = [];
  const deps = {
    userEventsRepo: {
      append: async (event: NewUserEventInput) => {
        told.push(event);
        return ok({ ...event, id: told.length, createdAt: new Date(0) });
      },
    },
    outboxRepo: {
      enqueue: async (item: NewOutboxInput) => {
        queued.push(item);
        return ok(item as never);
      },
    },
  };

  beforeEach(() => {
    told.length = 0;
    queued.length = 0;
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
    await announceCreated(deps, { created, owner, input, counted });

    expect(told.map(({ userId, type }) => [userId, type])).toEqual(expected);
  });

  it('queues one webhook announcement of a held comment, for the moderators but its author', async () => {
    const input = { authorId: AUTHOR, moderation: held, moderators: [OWNER, MODERATOR, AUTHOR] };

    await announceCreated(deps, { created, owner, input, counted: false });

    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload).toMatchObject({
      job: {
        name: 'announce-comment-held',
        data: { commentId: 'c1', videoId: 'v1', recipients: [OWNER, MODERATOR] },
      },
    });
  });

  it('queues nothing when the only moderator wrote the held comment', async () => {
    const input = { authorId: AUTHOR, moderation: held, moderators: [AUTHOR] };

    await announceCreated(deps, { created, owner, input, counted: false });

    expect([told, queued]).toEqual([[], []]);
  });

  describe('on a post', () => {
    const post: TargetOwner = { type: 'post', id: 'p1', ownerId: OWNER };
    const onPost = { ...created, target: { type: 'post', id: 'p1' } } satisfies CommentThread;

    it('tells no one of a public comment', async () => {
      await announceCreated(deps, {
        created: onPost,
        owner: post,
        input: { authorId: AUTHOR },
        counted: true,
      });

      expect([told, queued]).toEqual([[], []]);
    });

    it('tells the moderators on their stream but queues no webhook for a held comment', async () => {
      await announceCreated(deps, {
        created: onPost,
        owner: post,
        input: { authorId: AUTHOR, moderation: held, moderators: [OWNER] },
        counted: false,
      });

      expect(told.map(({ userId, type }) => [userId, type])).toEqual([[OWNER, 'comment.held']]);
      expect(queued).toEqual([]);
    });
  });
});
