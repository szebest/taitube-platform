import { expectOk } from '@kit/testing/result';
import type { ListHeldThreadsOptions, VideoThreadRepositoryPort } from '@vp/core/repositories';
import type { NewVideoThreadInput } from '@vp/domain';
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
import { PUBLISHED, T, pinAudit, removeAudit, threadInput } from './video-thread-contract-fixtures';

export function describeHeldVideoThreadContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoThreadRepository contract: held threads', () => {
    let subject: RepositoriesSubject;
    let threads: VideoThreadRepositoryPort;

    const create = async (id: string, over: Partial<NewVideoThreadInput> = {}) => {
      const created = expectOk(await threads.create(threadInput(id, over), 5));
      if (created.type !== 'created') throw new Error(`thread ${id} was refused`);
      return created.thread;
    };
    const listed = async () =>
      expectOk(await threads.listByVideo(VIDEO_IDS.a, { viewer: null, limit: 50 }));

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

    describe('held threads', () => {
      const HELD = { ...PUBLISHED, moderationState: 'held', heldReason: 'review_all' } as const;
      const approve = {
        outcome: { state: 'published', disclosure: null, reason: null, note: null },
      } as const;
      const moderateWrite = (
        id: string,
        from: 'held' | 'published',
        to: 'published' | 'hidden'
      ) => ({
        id,
        from,
        outcome: { ...approve.outcome, state: to },
        audit: removeAudit(id),
      });
      const held = async (over: Partial<ListHeldThreadsOptions> = {}) =>
        expectOk(
          await threads.listHeld({ channelId: OWNER_CHANNEL_ID, cursor: null, limit: 10, ...over })
        ).map(({ thread }) => thread.id);

      it('tells the moderators but the author, once', async () => {
        await create(T.a, { moderation: HELD, moderators: [OWNER_ID, OTHER_OWNER_ID] });

        const events = expectOk(await subject.repositories.userEvents.listFrom(OWNER_ID, 0, 10));
        const authors = expectOk(
          await subject.repositories.userEvents.listFrom(OTHER_OWNER_ID, 0, 10)
        );

        expect(events).toMatchObject([
          { type: 'comment.held', payload: { commentId: T.a, videoId: null } },
        ]);
        expect(authors).toEqual([]);
      });

      it('lists the channel held threads newest first, by author, from a cursor', async () => {
        await create(T.a, { moderation: HELD });
        await create(T.b, { moderation: HELD, authorId: OWNER_ID });
        await create(T.c);

        const [first] = expectOk(
          await threads.listHeld({ channelId: OWNER_CHANNEL_ID, cursor: null, limit: 1 })
        );
        if (!first) throw new Error('no held thread listed');

        expect(await held()).toEqual([T.b, T.a]);
        expect(await held({ authorId: OTHER_OWNER_ID })).toEqual([T.a]);
        expect(await held({ channelId: OTHER_OWNER_CHANNEL_ID })).toEqual([]);
        expect(first.thread.id).toBe(T.b);
        expect(
          await held({ cursor: { createdAt: first.thread.createdAt, id: T.b }, limit: 5 })
        ).toEqual([T.a]);
      });

      it('approves a held thread once, with its audit row, and refuses a stale write', async () => {
        await create(T.a, { moderation: HELD });

        const applied = expectOk(await threads.moderate(moderateWrite(T.a, 'held', 'published')));
        const stale = expectOk(await threads.moderate(moderateWrite(T.a, 'held', 'published')));
        const missing = expectOk(
          await threads.moderate(moderateWrite(T.missing, 'held', 'published'))
        );

        expect(applied).toMatchObject({
          type: 'applied',
          thread: { id: T.a, moderationState: 'published', heldReason: null },
        });
        expect(stale).toEqual({ type: 'stale', state: 'published' });
        expect(missing).toEqual({ type: 'missing' });
        expect(await held()).toEqual([]);
        expect((await listed()).map(({ thread }) => thread.id)).toEqual([T.a]);
        const audit = expectOk(
          await subject.repositories.channelAudit.list(OWNER_CHANNEL_ID, {
            cursor: null,
            limit: 10,
          })
        );
        expect(audit.filter((row) => row.targetId === T.a)).toHaveLength(1);
      });

      it('unpins a thread that leaves public reads', async () => {
        await create(T.a);
        expectOk(await threads.setPinned(T.a, true, 3, pinAudit(T.a)));

        expectOk(await threads.moderate(moderateWrite(T.a, 'published', 'hidden')));

        expect(expectOk(await threads.findById(T.a))).toMatchObject({
          moderationState: 'hidden',
          pinnedAt: null,
        });
      });
    });
  });
}
