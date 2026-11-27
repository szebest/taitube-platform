import { ok } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { moderateThread } from '../thread-moderate';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const AUTHOR = '22222222-2222-7222-8222-222222222222';
const VIDEO = '33333333-3333-7333-8333-333333333333';
const THREAD = '44444444-4444-7444-8444-444444444444';

describe('apps/server/api/services: thread moderation', () => {
  let repositories: InMemoryRepositories;
  let channelId: string;

  const moderate = (body: Parameters<typeof moderateThread>[3], threadId = THREAD) =>
    moderateThread(
      {
        videos: repositories.videos,
        threads: repositories.videoThreads,
        settings: repositories.commentSettings,
        commentCache: { getHot: async (_id, fetch) => fetch(), invalidate: async () => ok() },
      },
      OWNER,
      threadId,
      body
    );
  const stateOfThread = async () =>
    expectOk(await repositories.videoThreads.findById(THREAD))?.moderationState;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await repositories.users.upsert({ id: OWNER.id, email: 'o@example.com' });
    await repositories.users.upsert({ id: AUTHOR, email: 'a@example.com' });
    channelId = await seedPrimaryChannel(repositories, OWNER.id);
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER.id,
        channelId,
        sourceKey: 'raw/v/source.mp4',
        title: 'Open',
        visibility: 'public',
        status: 'READY',
      })
    );
    expectOk(
      await repositories.videoThreads.create(
        {
          id: THREAD,
          videoId: VIDEO,
          channelId,
          authorId: AUTHOR,
          authorChannelId: await seedPrimaryChannel(repositories, AUTHOR),
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
      )
    );
  });

  it('approves a held thread and records the action on the channel audit log', async () => {
    const result = expectOk(await moderate({ action: 'approve' }));

    const audit = expectOk(
      await repositories.channelAudit.list(channelId, { cursor: null, limit: 10 })
    );
    expect(result).toEqual({ state: 'published', comment: null });
    expect(await stateOfThread()).toBe('published');
    expect(audit).toMatchObject([{ action: 'comment.approved', targetId: THREAD }]);
  });

  it('removes the thread for the same action a comment is removed by', async () => {
    const result = expectOk(await moderate({ action: 'remove', disclosure: 'silent' }));

    expect(result).toEqual({ state: 'removed', comment: null });
    expect(expectOk(await repositories.videoThreads.findById(THREAD))).toBeNull();
  });

  it('hides a published thread and takes it out of public reads', async () => {
    await moderate({ action: 'approve' });

    const result = expectOk(
      await moderate({ action: 'hide', disclosure: 'visible', reason: 'spam' })
    );

    expect(result.state).toBe('hidden');
    expect(await stateOfThread()).toBe('hidden');
  });

  it.each([
    {
      scenario: 'the state moved under it',
      written: { type: 'stale', state: 'published' } as const,
      code: ErrorCodes.MODERATION_NOT_APPLICABLE,
    },
    {
      scenario: 'the thread was removed under it',
      written: { type: 'missing' } as const,
      code: ErrorCodes.THREAD_NOT_FOUND,
    },
  ])('refuses the action when $scenario', async ({ written, code }) => {
    vi.spyOn(repositories.videoThreads, 'moderate').mockResolvedValue(ok(written));

    expect(expectErr(await moderate({ action: 'approve' })).code).toBe(code);
  });

  it('refuses an action the state does not take, and a thread that is not there', async () => {
    const unhide = await moderate({ action: 'unhide' });
    const gone = await moderate({ action: 'approve' }, '99999999-9999-7999-8999-999999999999');

    expect(expectErr(unhide).code).toBe(ErrorCodes.MODERATION_NOT_APPLICABLE);
    expect(expectErr(gone).code).toBe(ErrorCodes.THREAD_NOT_FOUND);
  });
});
