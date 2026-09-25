import type { CommentRepositoryPort, CommentWindow } from '@vp/core/repositories';
import type { CommentThread } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';

const C = {
  old: '00000000-0000-7000-8000-000000000c01',
  liked: '00000000-0000-7000-8000-000000000c02',
  fresh: '00000000-0000-7000-8000-000000000c03',
  reply1: '00000000-0000-7000-8000-000000000c04',
  reply2: '00000000-0000-7000-8000-000000000c05',
  other: '00000000-0000-7000-8000-000000000c06',
} as const;

const BASE = Date.parse('2026-03-01T12:00:00.000Z');

function keyset(limit: number): CommentWindow {
  return { type: 'keyset', cursor: null, limit };
}

function nextWindow(row: CommentThread, limit: number): CommentWindow {
  const { isPinned, likeCount, createdAt, id } = row;
  return { type: 'keyset', cursor: { isPinned, likeCount, createdAt, id }, limit };
}

export function describeCommentRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('CommentRepository contract', () => {
    let subject: RepositoriesSubject;
    let comments: CommentRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    async function commentsCount(videoId: string): Promise<number | undefined> {
      return expectOk(await subject.repositories.videos.findById(videoId))?.commentsCount;
    }

    async function comment(
      id: string,
      options: { parentId?: string; hoursAgo?: number; likes?: number; videoId?: string } = {}
    ) {
      expectOk(
        await comments.create({
          id,
          videoId: options.videoId ?? VIDEO_IDS.a,
          authorId: OTHER_OWNER_ID,
          parentId: options.parentId ?? null,
          content: `comment ${id.slice(-2)}`,
        })
      );
      await subject.adjustComment(id, {
        createdAt: new Date(BASE - (options.hoursAgo ?? 0) * HOUR_MS),
        likeCount: options.likes ?? 0,
      });
    }

    async function seedThreads() {
      await comment(C.old, { hoursAgo: 3, likes: 1 });
      await comment(C.liked, { hoursAgo: 2, likes: 9 });
      await comment(C.fresh, { hoursAgo: 1 });
      await comment(C.reply1, { parentId: C.liked, hoursAgo: 0.5 });
      await comment(C.reply2, { parentId: C.liked, hoursAgo: 0.25 });
    }

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      comments = subject.repositories.comments;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
      await subject.repositories.channels.create({
        id: CHANNEL_ID,
        userId: OTHER_OWNER_ID,
        handle: 'commenter',
        displayName: 'The Commenter',
      });
    });

    it('creates a comment with its author profile and counts it on the video', async () => {
      const created = expectOk(
        await comments.create({
          id: C.old,
          videoId: VIDEO_IDS.a,
          authorId: OTHER_OWNER_ID,
          parentId: null,
          content: 'first',
        })
      );

      expect(created).toMatchObject({
        id: C.old,
        videoId: VIDEO_IDS.a,
        parentId: null,
        content: 'first',
        isPinned: false,
        isEdited: false,
        likeCount: 0,
        replyCount: 0,
        author: {
          userId: OTHER_OWNER_ID,
          channelId: CHANNEL_ID,
          handle: 'commenter',
          displayName: 'The Commenter',
          avatarUrl: null,
        },
      });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(await commentsCount(VIDEO_IDS.a)).toBe(1);
    });

    it('leaves the channel fields empty for an author without a channel', async () => {
      const created = expectOk(
        await comments.create({
          id: C.old,
          videoId: VIDEO_IDS.a,
          authorId: OWNER_ID,
          parentId: null,
          content: 'no channel',
        })
      );

      expect(created.author).toEqual({
        userId: OWNER_ID,
        channelId: null,
        handle: null,
        displayName: null,
        avatarUrl: null,
      });
    });

    it('keeps every write to comments_count exact under concurrent creates', async () => {
      const ids = Array.from(
        { length: 10 },
        (_, i) => `00000000-0000-7000-8000-0000000000${10 + i}`
      );

      await Promise.all(
        ids.map((id) =>
          comments.create({
            id,
            videoId: VIDEO_IDS.a,
            authorId: OTHER_OWNER_ID,
            parentId: null,
            content: id,
          })
        )
      );

      expect(await commentsCount(VIDEO_IDS.a)).toBe(10);
    });

    it('ranks roots by likes then recency, carrying each thread reply count', async () => {
      await seedThreads();

      const top = expectOk(
        await comments.listThreads(VIDEO_IDS.a, { sort: 'top', window: keyset(10) })
      );

      expect(idsOf(top)).toEqual([C.liked, C.old, C.fresh]);
      expect(top.map((row) => row.replyCount)).toEqual([2, 0, 0]);
    });

    it('ranks roots by recency alone under newest', async () => {
      await seedThreads();

      const newest = expectOk(
        await comments.listThreads(VIDEO_IDS.a, { sort: 'newest', window: keyset(10) })
      );

      expect(idsOf(newest)).toEqual([C.fresh, C.liked, C.old]);
    });

    it.each(['top', 'newest'] as const)('puts the pinned comment first under %s', async (sort) => {
      await seedThreads();
      expectOk(await comments.setPinned({ id: C.old, videoId: VIDEO_IDS.a }, true));

      const [first] = expectOk(
        await comments.listThreads(VIDEO_IDS.a, { sort, window: keyset(10) })
      );

      expect(first).toMatchObject({ id: C.old, isPinned: true });
    });

    it.each([
      { sort: 'top' as const, order: [C.old, C.liked, C.fresh] },
      { sort: 'newest' as const, order: [C.old, C.fresh, C.liked] },
    ])('walks every root once from keyset cursors under $sort', async ({ sort, order }) => {
      await seedThreads();
      expectOk(await comments.setPinned({ id: C.old, videoId: VIDEO_IDS.a }, true));
      const seen: string[] = [];
      let window = keyset(1);

      for (let page = 0; page < 5; page++) {
        const rows = expectOk(await comments.listThreads(VIDEO_IDS.a, { sort, window }));
        const [row] = rows;
        if (!row) break;
        seen.push(row.id);
        if (rows.length < 2) break;
        window = nextWindow(row, 1);
      }

      expect(seen).toEqual(order);
    });

    it('serves an offset window for the legacy page query', async () => {
      await seedThreads();

      const page = expectOk(
        await comments.listThreads(VIDEO_IDS.a, {
          sort: 'top',
          window: { type: 'offset', offset: 1, limit: 1 },
        })
      );

      expect(idsOf(page)).toEqual([C.old, C.fresh]);
    });

    it('keeps each video to its own comments', async () => {
      await seedThreads();
      await comment(C.other, { videoId: VIDEO_IDS.b });

      const other = expectOk(
        await comments.listThreads(VIDEO_IDS.b, { sort: 'top', window: keyset(10) })
      );

      expect(idsOf(other)).toEqual([C.other]);
      expect(await commentsCount(VIDEO_IDS.b)).toBe(1);
    });

    it('lists a thread replies oldest first and resumes from a cursor', async () => {
      await seedThreads();
      const root = { id: C.liked, videoId: VIDEO_IDS.a };

      const all = expectOk(await comments.listReplies(root, { cursor: null, limit: 10 }));
      const [first] = all;
      if (!first) throw new Error('the thread has no replies');
      const rest = expectOk(
        await comments.listReplies(root, {
          cursor: { createdAt: first.createdAt, id: first.id },
          limit: 10,
        })
      );

      expect(idsOf(all)).toEqual([C.reply1, C.reply2]);
      expect(all[0]?.author.handle).toBe('commenter');
      expect(idsOf(rest)).toEqual([C.reply2]);
    });

    it('edits the content and marks the comment edited', async () => {
      await comment(C.old);

      const edited = expectOk(await comments.updateContent(C.old, 'rewritten'));

      expect(edited).toMatchObject({ id: C.old, content: 'rewritten', isEdited: true });
      expect(expectOk(await comments.findById(C.old))?.content).toBe('rewritten');
    });

    it('removes a root with its replies and takes them all off the count', async () => {
      await seedThreads();

      const removed = expectOk(await comments.remove({ id: C.liked, videoId: VIDEO_IDS.a }));

      expect(removed).toBe(3);
      expect(await commentsCount(VIDEO_IDS.a)).toBe(2);
      expect(expectOk(await comments.findById(C.liked))).toBeNull();
      expect(expectOk(await comments.findById(C.reply1))).toBeNull();
      expect(expectOk(await comments.updateContent(C.liked, 'too late'))).toBeNull();
      expect(
        idsOf(
          expectOk(await comments.listThreads(VIDEO_IDS.a, { sort: 'top', window: keyset(10) }))
        )
      ).toEqual([C.old, C.fresh]);
    });

    it('removes a reply and drops it from its root reply count', async () => {
      await seedThreads();

      expect(expectOk(await comments.remove({ id: C.reply1, videoId: VIDEO_IDS.a }))).toBe(1);
      expect(expectOk(await comments.remove({ id: C.reply1, videoId: VIDEO_IDS.a }))).toBe(0);

      const [liked] = expectOk(
        await comments.listThreads(VIDEO_IDS.a, { sort: 'top', window: keyset(1) })
      );
      expect(liked).toMatchObject({ id: C.liked, replyCount: 1 });
      expect(await commentsCount(VIDEO_IDS.a)).toBe(4);
    });

    it('holds one pinned comment per video, unpinning the previous one', async () => {
      await seedThreads();
      const at = (id: string) => ({ id, videoId: VIDEO_IDS.a });

      expectOk(await comments.setPinned(at(C.old), true));
      const pinned = expectOk(await comments.setPinned(at(C.fresh), true));

      expect(pinned).toMatchObject({ id: C.fresh, isPinned: true });
      expect(expectOk(await comments.findById(C.old))?.isPinned).toBe(false);

      const unpinned = expectOk(await comments.setPinned(at(C.fresh), false));
      expect(unpinned?.isPinned).toBe(false);
    });

    it('answers null when pinning a comment that is gone', async () => {
      expect(
        expectOk(await comments.setPinned({ id: C.old, videoId: VIDEO_IDS.a }, true))
      ).toBeNull();
    });
  });
}
