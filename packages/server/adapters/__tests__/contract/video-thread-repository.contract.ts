import { expectOk } from '@kit/testing/result';
import type { VideoThreadRepositoryPort } from '@vp/core/repositories';
import type { NewChannelAuditEntry, NewVideoThreadInput, VideoThread } from '@vp/domain';
import {
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const T = {
  a: '00000000-0000-7000-8000-000000000b01',
  b: '00000000-0000-7000-8000-000000000b02',
  c: '00000000-0000-7000-8000-000000000b03',
  d: '00000000-0000-7000-8000-000000000b04',
  missing: '00000000-0000-7000-8000-000000000bff',
} as const;

const REPLY = '00000000-0000-7000-8000-000000000b81';

const PUBLISHED = {
  moderationState: 'published',
  moderationDisclosure: null,
  heldReason: null,
  looksLikeQuestion: false,
} as const;

const threadInput = (id: string, over: Partial<NewVideoThreadInput> = {}): NewVideoThreadInput => ({
  id,
  videoId: VIDEO_IDS.a,
  channelId: OWNER_CHANNEL_ID,
  authorId: OTHER_OWNER_ID,
  authorChannelId: OTHER_OWNER_CHANNEL_ID,
  anchorMs: 1_000,
  title: `Thread ${id.slice(-1)}`,
  body: '',
  moderation: PUBLISHED,
  ...over,
});

const pinAudit = (id: string): NewChannelAuditEntry => ({
  channelId: OWNER_CHANNEL_ID,
  actorUserId: OWNER_ID,
  action: 'comment.pinned',
  targetType: 'comment',
  targetId: id,
  meta: { videoId: VIDEO_IDS.a, pinned: true },
});

const removeAudit = (id: string): NewChannelAuditEntry => ({
  channelId: OWNER_CHANNEL_ID,
  actorUserId: OWNER_ID,
  action: 'comment.removed',
  targetType: 'comment',
  targetId: id,
  meta: { videoId: VIDEO_IDS.a, disclosure: 'silent' },
});

export function describeVideoThreadRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoThreadRepository contract', () => {
    let subject: RepositoriesSubject;
    let threads: VideoThreadRepositoryPort;

    const create = async (id: string, over: Partial<NewVideoThreadInput> = {}) => {
      const created = expectOk(await threads.create(threadInput(id, over), 5));
      if (created.type !== 'created') throw new Error(`thread ${id} was refused`);
      return created.thread;
    };
    const reply = async (threadId: string, id: string, authorId: string, channelId: string) =>
      subject.repositories.comments.create({
        id,
        target: { type: 'thread', id: threadId },
        channelId: OWNER_CHANNEL_ID,
        authorId,
        authorChannelId: channelId,
        parentId: null,
        content: 'a reply',
      });
    const listed = async (viewerId: string | null = null) =>
      expectOk(
        await threads.listByVideo(VIDEO_IDS.a, {
          viewer: viewerId ? { id: viewerId } : null,
          limit: 50,
        })
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      threads = subject.repositories.videoThreads;
    });

    it('stores a thread and lists it with its author', async () => {
      const thread: VideoThread = await create(T.a, { title: 'The cut', anchorMs: 4_200 });

      const [entry] = await listed();

      expect(expectOk(await threads.findById(T.a))).toEqual(thread);
      expect(entry).toMatchObject({
        thread: { id: T.a, title: 'The cut', anchorMs: 4_200, pinnedAt: null, commentsCount: 0 },
        author: { channelId: OTHER_OWNER_CHANNEL_ID, handle: 'other' },
        replyCount: 0,
        markerReplies: 0,
        markerRepliers: 0,
      });
      expect(expectOk(await threads.findEntry(T.a))).toEqual(entry);
      expect(expectOk(await threads.findById(T.missing))).toBeNull();
      expect(expectOk(await threads.findEntry(T.missing))).toBeNull();
    });

    it('refuses the thread past the open limit and counts held ones too', async () => {
      await create(T.a);
      await create(T.b, {
        moderation: { ...PUBLISHED, moderationState: 'held', heldReason: 'review_all' },
      });

      expect(expectOk(await threads.countOpen(VIDEO_IDS.a, OTHER_OWNER_ID))).toBe(2);
      expect(expectOk(await threads.create(threadInput(T.c), 2))).toEqual({ type: 'limit' });
      expect(
        expectOk(await threads.create(threadInput(T.c, { authorId: OWNER_ID }), 2))
      ).toMatchObject({
        type: 'created',
      });
    });

    it('lists pinned first, then by anchor, and shows a held thread to its author only', async () => {
      await create(T.a, { anchorMs: 9_000 });
      await create(T.b, { anchorMs: 1_000 });
      await create(T.c, {
        anchorMs: 500,
        authorId: OWNER_ID,
        authorChannelId: OWNER_CHANNEL_ID,
        moderation: { ...PUBLISHED, moderationState: 'held', heldReason: 'review_all' },
      });
      expectOk(await threads.setPinned(T.a, true, 3, pinAudit(T.a)));

      const order = async (viewerId: string | null) =>
        (await listed(viewerId)).map(({ thread }) => thread.id);

      expect(await order(null)).toEqual([T.a, T.b]);
      expect(await order(OTHER_OWNER_ID)).toEqual([T.a, T.b]);
      expect(await order(OWNER_ID)).toEqual([T.a, T.c, T.b]);
    });

    it('pins up to the limit, once, and unpins idempotently', async () => {
      await create(T.a);
      await create(T.b);
      await create(T.c);

      const pin = async (id: string, pinned = true) =>
        expectOk(await threads.setPinned(id, pinned, 2, pinAudit(id)));

      expect(await pin(T.a)).toBe('pinned');
      expect(await pin(T.a)).toBe('pinned');
      expect(await pin(T.b)).toBe('pinned');
      expect(await pin(T.c)).toBe('limit');
      expect(await pin(T.a, false)).toBe('unpinned');
      expect(await pin(T.a, false)).toBe('unpinned');
      expect(await pin(T.c)).toBe('pinned');
      expect(await pin(T.missing)).toBe('missing');
    });

    it('counts replies for the marker from distinct, unrestricted viewers only', async () => {
      await create(T.a);
      expectOk(await reply(T.a, REPLY, OWNER_ID, OWNER_CHANNEL_ID));
      expectOk(await reply(T.a, T.d, OTHER_OWNER_ID, OTHER_OWNER_CHANNEL_ID));
      expectOk(await reply(T.a, T.c, OTHER_OWNER_ID, OTHER_OWNER_CHANNEL_ID));

      const [before] = await listed();

      expectOk(
        await subject.repositories.channelUserRestrictions.apply({
          channelId: OWNER_CHANNEL_ID,
          userId: OTHER_OWNER_ID,
          kind: 'shadow',
          reason: null,
          expiresAt: null,
          createdBy: OWNER_ID,
        })
      );
      const [after] = await listed();

      expect(before).toMatchObject({ replyCount: 3, markerReplies: 3, markerRepliers: 2 });
      expect(after).toMatchObject({ markerReplies: 1, markerRepliers: 1 });
    });

    it('removes a thread with its comments, once, and records why', async () => {
      await create(T.a);
      expectOk(await reply(T.a, REPLY, OWNER_ID, OWNER_CHANNEL_ID));

      const removed = expectOk(await threads.remove(T.a, { audit: removeAudit(T.a) }));
      const again = expectOk(await threads.remove(T.a, { audit: removeAudit(T.a) }));

      expect(removed).toBe(true);
      expect(again).toBe(false);
      expect(expectOk(await threads.findById(T.a))).toBeNull();
      expect(expectOk(await subject.repositories.comments.findById(REPLY))).toBeNull();
      const audit = expectOk(
        await subject.repositories.channelAudit.list(OWNER_CHANNEL_ID, { cursor: null, limit: 10 })
      );
      expect(audit.map((row) => `${row.action}:${row.targetId}`)).toContain(
        `comment.removed:${T.a}`
      );
    });
  });
}
