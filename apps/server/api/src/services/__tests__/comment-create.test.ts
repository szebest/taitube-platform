import { MS_PER_DAY } from '@kit/primitives';
import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { createComment } from '../comment-create';
import {
  type CommentCreateHarness,
  MISSING_ID,
  OWNER,
  START,
  VIDEO_ID,
  VIDEO_TARGET,
  VIEWER,
  OTHER,
  setUpCommentCreate,
} from './comment-create-harness';
import { commentCreateDeps } from './comment-deps';

const DAY_MS = MS_PER_DAY;

describe('apps/server/api/services: create comment', () => {
  let h: CommentCreateHarness;

  beforeEach(async () => {
    h = await setUpCommentCreate();
  });

  it('stores the comment and answers its view', async () => {
    const view = expectOk(await h.create(VIEWER));

    expect(view).toMatchObject({
      content: 'hi',
      parentId: null,
      status: 'published',
      moderation: null,
    });
    expect(expectOk(await h.repositories.comments.findById(view.id))?.authorId).toBe(VIEWER.id);
  });

  it('publishes on a channel that never saved its settings', async () => {
    const lonely = await h.repositories.videos.create({
      id: MISSING_ID,
      ownerId: VIEWER.id,
      channelId: h.acting(VIEWER).channelId,
      sourceKey: 'raw/x/source.mp4',
      visibility: 'public',
      status: 'READY',
    });
    expectOk(lonely);

    const view = expectOk(
      await createComment(
        commentCreateDeps(h.repositories, h.now),
        OTHER,
        h.acting(OTHER),
        { type: 'video', id: MISSING_ID },
        { content: 'hi' }
      )
    );

    expect(view.status).toBe('published');
  });

  it('posts as the acting channel and records it in that channel audit log', async () => {
    const view = expectOk(await h.create(VIEWER));
    const { channelId } = h.acting(VIEWER);

    expect(expectOk(await h.repositories.comments.findById(view.id))?.authorChannelId).toBe(
      channelId
    );
    expect(
      expectOk(await h.repositories.channelAudit.list(channelId, { cursor: null, limit: 10 }))
    ).toEqual([
      expect.objectContaining({
        action: 'comment.posted',
        actorUserId: VIEWER.id,
        targetId: view.id,
        meta: { videoId: VIDEO_ID },
      }),
    ]);
  });

  it('refuses a channel the author cannot act as', async () => {
    const failure = expectErr(
      await createComment(
        commentCreateDeps(h.repositories, h.now),
        VIEWER,
        h.acting(OTHER),
        VIDEO_TARGET,
        { content: 'hi' }
      )
    );

    expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it.each([
    {
      scenario: 'a video that is not there',
      target: { type: 'video', id: MISSING_ID },
      parentId: undefined,
    },
    { scenario: 'a parent that is not there', target: VIDEO_TARGET, parentId: MISSING_ID },
  ] as const)('refuses $scenario', async ({ target, parentId }) => {
    const failure = expectErr(
      await createComment(
        commentCreateDeps(h.repositories, h.now),
        VIEWER,
        h.acting(VIEWER),
        target,
        {
          content: 'hi',
          parentId,
        }
      )
    );

    expect([ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.COMMENT_NOT_FOUND]).toContain(failure.code);
  });

  describe('the refusals', () => {
    it.each<{
      scenario: string;
      arrange: () => Promise<void>;
      author?: UserContext;
      code: string;
      payload?: object;
    }>([
      {
        scenario: 'a visible ban with its reason',
        arrange: async () => {
          expectOk(
            await h.repositories.channelUserRestrictions.apply({
              channelId: h.channelId,
              userId: VIEWER.id,
              kind: 'ban',
              reason: 'spam',
              expiresAt: new Date(START + DAY_MS),
              createdBy: OWNER.id,
            })
          );
        },
        code: ErrorCodes.COMMENTS_BANNED,
        payload: { reason: 'spam', expiresAt: new Date(START + DAY_MS).toISOString() },
      },
      {
        scenario: 'comments turned off on the video',
        arrange: async () => {
          const video = expectOk(await h.repositories.videos.findById(VIDEO_ID));
          if (video) video.commentsEnabled = false;
        },
        code: ErrorCodes.COMMENTS_DISABLED,
      },
      {
        scenario: 'subscribers only, for someone who is not subscribed',
        arrange: async () => {
          await h.configure({ subscribersOnly: true });
        },
        code: ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY,
      },
      {
        scenario: 'an account younger than the minimum, with the day it opens',
        arrange: async () => {
          await h.configure({ minAccountAgeDays: 7 });
        },
        code: ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW,
      },
    ])(
      'refuses $scenario and stores nothing',
      async ({ arrange, author = VIEWER, code, payload }) => {
        await arrange();

        const failure = expectErr(await h.create(author));

        expect(failure).toMatchObject({ code, ...payload });
        expect(
          expectOk(await h.repositories.comments.listOwnNonPublic(VIDEO_TARGET, author.id))
        ).toEqual([]);
      }
    );

    it('lets the owner comment on a video with comments off', async () => {
      const video = expectOk(await h.repositories.videos.findById(VIDEO_ID));
      if (video) video.commentsEnabled = false;

      expect(expectOk(await h.create(OWNER)).status).toBe('published');
    });

    it('lets a subscriber comment on a subscribers only channel', async () => {
      await h.configure({ subscribersOnly: true });
      expectOk(
        await h.repositories.subscriptions.subscribe(
          VIEWER.id,
          h.acting(VIEWER).channelId,
          h.channelId
        )
      );

      expect(expectOk(await h.create(VIEWER)).status).toBe('published');
    });

    it('ends a ban at its expiry, by the clock, with no job having run', async () => {
      expectOk(
        await h.repositories.channelUserRestrictions.apply({
          channelId: h.channelId,
          userId: VIEWER.id,
          kind: 'ban',
          reason: null,
          expiresAt: new Date(START + DAY_MS),
          createdBy: OWNER.id,
        })
      );
      expect(expectErr(await h.create(VIEWER)).code).toBe(ErrorCodes.COMMENTS_BANNED);

      h.setClock(START + DAY_MS);

      expect(expectOk(await h.create(VIEWER)).status).toBe('published');
    });

    it('opens an account on the day the minimum is reached', async () => {
      await h.configure({ minAccountAgeDays: 7 });
      expect(expectErr(await h.create(VIEWER)).code).toBe(ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW);

      h.setClock(START + 8 * DAY_MS);

      expect(expectOk(await h.create(VIEWER)).status).toBe('published');
    });
  });
});
