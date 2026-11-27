import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { NOW, OWNER, STRANGER, postsFixture } from './post-deps';

const DAY = 86_400_000;
const TEXT: PostPayload = { kind: 'text', text: 'hello' };
const POLL: PostPayload = {
  kind: 'poll',
  question: 'Best?',
  options: ['a', 'b'],
  closesAt: null,
};
const later = (days: number) => new Date(NOW + days * DAY).toISOString();

describe('apps/server/api/services: createPost', () => {
  it('keeps a draft out of the listing, the feed and the subscriber job', async () => {
    const { service, manage, acting, repositories } = await postsFixture();

    const draft = expectOk(
      await service.create(OWNER, acting, {
        payload: TEXT,
        commentsEnabled: true,
        timing: { mode: 'draft' },
      })
    );

    expect(draft).toMatchObject({ status: 'draft', publishAt: null, publishedAt: null });
    expectErr(await service.get(null, draft.id));
    expect(expectOk(await manage.list(OWNER, acting, {})).items.map((post) => post.id)).toEqual([
      draft.id,
    ]);
    expect(expectOk(await repositories.outbox.claimBatch(10))).toEqual([]);
  });

  it('schedules a post for a later time and shows it to the team only', async () => {
    const { service, acting } = await postsFixture();

    const scheduled = expectOk(
      await service.create(OWNER, acting, {
        payload: TEXT,
        commentsEnabled: true,
        timing: { mode: 'schedule', publishAt: later(1) },
      })
    );

    expect(scheduled).toMatchObject({ status: 'scheduled', publishAt: later(1) });
    expectErr(await service.get(null, scheduled.id));
  });

  it.each([
    {
      scenario: 'a time in the past',
      timing: { mode: 'schedule', publishAt: later(-1) } as const,
      code: ErrorCodes.POST_SCHEDULE_INVALID,
    },
    {
      scenario: 'a poll that closes in the past',
      timing: undefined,
      payload: { ...POLL, closesAt: later(-1) } as PostPayload,
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a poll that closes past 30 days',
      timing: undefined,
      payload: { ...POLL, closesAt: later(31) } as PostPayload,
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a poll with one option',
      timing: undefined,
      payload: { ...POLL, options: ['a'] } as PostPayload,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario', async ({ timing, payload, code }) => {
    const { service, acting } = await postsFixture();

    const failure = expectErr(
      await service.create(OWNER, acting, {
        payload: payload ?? TEXT,
        commentsEnabled: true,
        timing,
      })
    );

    expect(failure.code).toBe(code);
  });

  it.each([
    { scenario: 'before the post publishes', closesInDays: 2, ok: false },
    { scenario: 'within 30 days of the time it publishes', closesInDays: 20, ok: true },
    { scenario: 'past 30 days of the time it publishes', closesInDays: 45, ok: false },
  ])(
    'holds the close time of a scheduled poll to its publish time: $scenario',
    async ({ closesInDays, ok }) => {
      const { service, acting } = await postsFixture();

      const result = await service.create(OWNER, acting, {
        payload: { ...POLL, closesAt: later(closesInDays) },
        commentsEnabled: true,
        timing: { mode: 'schedule', publishAt: later(10) },
      });

      expect(result.ok).toBe(ok);
    }
  );

  it('refuses an image that is not a ready post image of the channel, and names it', async () => {
    const { service, acting, readyImage, repositories } = await postsFixture();
    const other = expectOk(
      await repositories.channels.createOwned(
        { userId: STRANGER.id, handle: 'other', displayName: 'Other' },
        5
      )
    );
    const foreign = await readyImage(other.id);
    const own = await readyImage();

    const failure = expectErr(
      await service.create(OWNER, acting, {
        payload: {
          kind: 'images',
          images: [
            { uploadId: own, alt: 'mine' },
            { uploadId: foreign, alt: 'theirs' },
          ],
          caption: null,
        },
        commentsEnabled: true,
      })
    );

    expect(failure).toMatchObject({ code: ErrorCodes.POST_IMAGE_NOT_READY, uploadId: foreign });
  });

  it('holds at most 50 drafts and scheduled posts, and the 51st is refused', async () => {
    const { service, acting, repositories } = await postsFixture();
    for (let index = 0; index < 50; index += 1) {
      const id = `00000000-0000-7000-8000-${String(index).padStart(12, '0')}`;
      expectOk(
        await repositories.channelPosts.saveUnpublished(
          {
            id,
            channelId: acting.channelId,
            authorUserId: OWNER.id,
            payload: TEXT,
            commentsEnabled: true,
            status: 'draft',
            publishAt: null,
          },
          {
            channelId: acting.channelId,
            actorUserId: OWNER.id,
            action: 'post.updated',
            targetType: 'post',
            targetId: id,
            meta: { kind: 'text' },
          }
        )
      );
      const stored = repositories.channelPosts.posts.get(id);
      if (stored) stored.createdAt = new Date(NOW - 2 * DAY);
    }

    const failure = expectErr(
      await service.create(OWNER, acting, {
        payload: TEXT,
        commentsEnabled: true,
        timing: { mode: 'draft' },
      })
    );

    expect(failure).toMatchObject({ code: ErrorCodes.POST_DRAFT_LIMIT, limit: 50 });
  });

  it('shows the team a poll with its results, and the creator no correct answer withheld', async () => {
    const { service, acting } = await postsFixture();

    const quiz = expectOk(
      await service.create(OWNER, acting, {
        payload: {
          kind: 'quiz',
          question: 'Q?',
          options: ['a', 'b'],
          closesAt: null,
          correctIndex: 1,
          explanation: 'because',
        },
        commentsEnabled: true,
      })
    );

    expect(quiz.body).toMatchObject({
      kind: 'quiz',
      correctIndex: 1,
      explanation: 'because',
      totalVotes: 0,
      votedIndex: null,
    });
  });
});
