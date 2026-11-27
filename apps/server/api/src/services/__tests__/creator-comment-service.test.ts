import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { CreatorInboxFilter } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { CreatorCommentService } from '../creator-comment-service';
import { ownerActing } from './service-deps';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const ACTING = ownerActing(OWNER.id, '44444444-4444-7444-8444-444444444444');
const FAN = '22222222-2222-7222-8222-222222222222';
const VIDEO_ID = '33333333-3333-7333-8333-333333333333';

describe('CreatorCommentService', () => {
  let repositories: InMemoryRepositories;
  let service: CreatorCommentService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new CreatorCommentService({
      comments: repositories.comments,
      threads: repositories.videoThreads,
      videos: repositories.videos,
      paginator: new Paginator(),
    });
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      channelId: ACTING.channelId,
      title: 'Clip',
      sourceKey: `raw/${VIDEO_ID}/source.mp4`,
      visibility: 'public',
      status: 'READY',
    });
    for (const content of ['one', 'two', 'three']) {
      await repositories.comments.create({
        id: crypto.randomUUID(),
        target: { type: 'video', id: VIDEO_ID },
        channelId: ACTING.channelId,
        authorId: FAN,
        authorChannelId: await seedPrimaryChannel(repositories, FAN),
        parentId: null,
        content,
      });
    }
  });

  it('pages the inbox with a cursor and renders each comment with its video', async () => {
    const first = expectOk(await service.inbox(OWNER, ACTING, { filter: 'all', limit: 2 }));
    const second = expectOk(
      await service.inbox(OWNER, ACTING, {
        filter: 'all',
        limit: 2,
        cursor: first.nextCursor ?? undefined,
      })
    );

    expect(first.items).toHaveLength(2);
    expect(first.items[0]).toMatchObject({ video: { id: VIDEO_ID, title: 'Clip' } });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('refuses a cursor it did not issue', async () => {
    const result = await service.inbox(OWNER, ACTING, { filter: 'all', cursor: 'garbage' });

    expect(expectErr(result).code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  describe('held threads', () => {
    const THREAD = '55555555-5555-7555-8555-555555555555';

    const startHeld = async () =>
      repositories.videoThreads.create(
        {
          id: THREAD,
          videoId: VIDEO_ID,
          channelId: ACTING.channelId,
          authorId: FAN,
          authorChannelId: await seedPrimaryChannel(repositories, FAN),
          anchorMs: 1_000,
          title: 'The cut',
          body: '',
          moderation: {
            moderationState: 'held',
            moderationDisclosure: 'silent',
            heldReason: 'review_all',
            looksLikeQuestion: false,
          },
        },
        5
      );
    const idsOf = async (filter: CreatorInboxFilter) =>
      expectOk(await service.inbox(OWNER, ACTING, { filter })).items.map(({ id }) => id);

    it.each([
      { filter: 'all' as const, listed: true },
      { filter: 'held' as const, listed: true },
      { filter: 'unanswered' as const, listed: false },
      { filter: 'reported' as const, listed: false },
      { filter: 'hidden' as const, listed: false },
      { filter: 'questions' as const, listed: false },
      { filter: 'restricted' as const, listed: false },
    ])('lists a held thread under $filter: $listed', async ({ filter, listed }) => {
      await startHeld();

      expect((await idsOf(filter)).includes(THREAD)).toBe(listed);
    });

    it('merges the threads into the pages, once each, across the cursor', async () => {
      await startHeld();
      const first = expectOk(await service.inbox(OWNER, ACTING, { filter: 'all', limit: 2 }));
      const second = expectOk(
        await service.inbox(OWNER, ACTING, {
          filter: 'all',
          limit: 2,
          cursor: first.nextCursor ?? undefined,
        })
      );

      const ids = [...first.items, ...second.items].map(({ id }) => id);

      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
      expect([...first.items, ...second.items].find(({ id }) => id === THREAD)).toMatchObject({
        targetSummary: { type: 'thread', id: THREAD, title: 'The cut' },
        video: { id: VIDEO_ID, title: 'Clip' },
      });
    });
  });
});
