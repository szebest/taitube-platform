import { ok } from '@kit/result';
import type { ChannelPost, CommentTarget, CommentThread, Video } from '@vp/domain';
import { editStored } from '../comment-edit';
import type { StoredComment } from '../comment-visibility';

const stored = (
  id: string,
  parentId: string | null = null,
  target: CommentTarget = { type: 'video', id: 'video' }
): StoredComment => ({
  id,
  target,
  channelId: 'channel',
  authorId: 'author',
  authorChannelId: 'channel-author',
  parentId,
  content: 'old',
  moderationState: 'published',
  moderationDisclosure: null,
  moderationReason: 'spam',
  moderationNote: 'note',
  moderatedBy: 'moderator',
  moderatedAt: new Date(0),
  heldReason: null,
  looksLikeQuestion: false,
  isPinned: true,
  isEdited: false,
  likeCount: 0,
  heartedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
});

const THREAD = { id: 'root', target: { type: 'video', id: 'video' } } as CommentThread;

function setUp({
  withVideo = true,
  target = { type: 'video', id: 'video' } as CommentTarget,
} = {}) {
  const root = stored('root', null, target);
  const reply = stored('reply', 'root', target);
  const comments = new Map([root, reply].map((row) => [row.id, row]));
  const video = withVideo ? { id: 'video', commentsCount: 2 } : null;
  const videos = { findById: async () => ok(video as Video | null) };
  const post = { id: 'post', commentsCount: 2 };
  const posts = new Map([[post.id, post as ChannelPost]]);
  const told: unknown[] = [];
  const events = {
    append: async (event: unknown) => {
      told.push(event);
      return ok(event as never);
    },
  };
  const queued: unknown[] = [];
  const outbox = {
    enqueue: async (item: unknown) => {
      queued.push(item);
      return ok(item as never);
    },
  };
  const edit = (changes: Parameters<typeof editStored>[5], content = 'new') =>
    editStored(
      {
        videosRepo: videos,
        postsRepo: { posts },
        channelsRepo: { findById: async () => ok(null) },
        userEventsRepo: events,
        outboxRepo: outbox,
      },
      root,
      [reply],
      { shadowed: new Map(), comments },
      content,
      changes,
      async () => ({ ...THREAD, target })
    );
  return { root, reply, video, post, told, queued, edit };
}

describe('in-memory: editStored', () => {
  it('rewrites the text and the question flag and leaves the state and the count alone', async () => {
    const { root, video, told, queued, edit } = setUp();

    await edit({ looksLikeQuestion: true });

    expect(root).toMatchObject({
      content: 'new',
      looksLikeQuestion: true,
      isEdited: true,
      moderationState: 'published',
      isPinned: true,
    });
    expect(video?.commentsCount).toBe(2);
    expect([told, queued]).toEqual([[], []]);
  });

  it('holds the comment, clears what a moderator wrote, takes it and its reply off the count and tells the moderators', async () => {
    const { root, reply, video, told, queued, edit } = setUp();

    const written = await edit({
      looksLikeQuestion: false,
      hold: { reason: 'link', disclosure: 'visible', moderators: ['owner'] },
    });

    expect(root).toMatchObject({
      moderationState: 'held',
      moderationDisclosure: 'visible',
      heldReason: 'link',
      moderationReason: null,
      moderationNote: null,
      moderatedBy: null,
      moderatedAt: null,
      isPinned: false,
    });
    expect(reply.moderationState).toBe('published');
    expect(video?.commentsCount).toBe(0);
    expect(told).toMatchObject([{ userId: 'owner', type: 'comment.held' }]);
    expect(queued).toMatchObject([{ payload: { job: { name: 'announce-comment-held' } } }]);
    expect(written).toEqual(ok(THREAD));
  });

  it('counts nothing on a video that is gone', async () => {
    const { root, edit } = setUp({ withVideo: false });

    await edit({ looksLikeQuestion: false }, 'again');

    expect(root.content).toBe('again');
  });

  it('moves the count of a post, not of a video', async () => {
    const { video, post, told, queued, edit } = setUp({ target: { type: 'post', id: 'post' } });

    await edit({
      looksLikeQuestion: false,
      hold: { reason: 'link', disclosure: 'visible', moderators: ['owner'] },
    });

    expect([video?.commentsCount, post.commentsCount]).toEqual([2, 0]);
    expect(told).toMatchObject([{ userId: 'owner', type: 'comment.held' }]);
    expect(queued).toEqual([]);
  });
});
