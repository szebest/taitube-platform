import { InMemoryCommentSlowMode } from '@vp/adapters/in-memory';
import type { CommentSlowModePort } from '@vp/core/ports';
import type { CommentSettings } from '@vp/domain';
import { ErrorCodes, cacheUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { createComment } from '../comment-create';
import {
  type CommentCreateHarness,
  OWNER,
  OTHER,
  START,
  VIDEO_ID,
  VIEWER,
  setUpCommentCreate,
} from './comment-create-harness';
import { commentCreateDeps } from './comment-deps';

describe('apps/server/api/services: create comment under moderation', () => {
  let h: CommentCreateHarness;

  beforeEach(async () => {
    h = await setUpCommentCreate();
  });

  describe('holding a comment', () => {
    it.each<{
      scenario: string;
      settings: Partial<CommentSettings>;
      content: string;
      status: string;
      moderation: object | null;
    }>([
      {
        scenario: 'every comment, told to the author',
        settings: { reviewMode: 'all' },
        content: 'hello',
        status: 'held',
        moderation: { state: 'held' },
      },
      {
        scenario: 'a link off the allowlist, told to the author',
        settings: { reviewMode: 'links', linkAllowlist: ['example.com'] },
        content: 'see https://other.dev/x',
        status: 'held',
        moderation: { state: 'held' },
      },
      {
        scenario: 'a blocked word, silent by default so it looks published',
        settings: { blockedWords: ['spoiler'] },
        content: 'a Spoiler here',
        status: 'published',
        moderation: null,
      },
    ])('holds $scenario', async ({ settings, content, status, moderation }) => {
      await h.configure(settings);

      const view = expectOk(await h.create(VIEWER, content));

      expect(await h.storedState(view.id)).toBe('held');
      expect(view).toMatchObject({ status, moderation });
    });

    it.each([
      { scenario: 'a link on the allowlist', content: 'see https://example.com/x' },
      { scenario: 'a comment with no link', content: 'plain words' },
    ])('publishes $scenario under links review', async ({ content }) => {
      await h.configure({ reviewMode: 'links', linkAllowlist: ['example.com'] });

      expect(await h.storedState(expectOk(await h.create(VIEWER, content)).id)).toBe('published');
    });

    it('lets a trusted commenter and a team member past every hold', async () => {
      await h.configure({ reviewMode: 'all', blockedWords: ['hi'] });
      expectOk(await h.repositories.trustedCommenters.add(h.channelId, VIEWER.id, OWNER.id));
      const moderator: UserContext = {
        ...OTHER,
        memberships: { [h.channelId]: { role: 'moderator', ownerId: OWNER.id } },
      };

      expect(await h.storedState(expectOk(await h.create(VIEWER)).id)).toBe('published');
      expect(await h.storedState(expectOk(await h.create(moderator)).id)).toBe('published');
    });

    it('tells the owner and each moderator, but not the author, that a comment is held', async () => {
      await h.configure({ reviewMode: 'all' });
      const moderatorId = '66666666-6666-7666-8666-666666666666';
      expectOk(
        await h.repositories.users.upsert({ id: moderatorId, email: 'm@example.com', tier: 'free' })
      );
      h.repositories.channelMembers.join({
        channelId: h.channelId,
        userId: moderatorId,
        role: 'moderator',
        invitedBy: OWNER.id,
        createdAt: new Date(START),
      });

      const held = expectOk(await h.create(VIEWER));

      const told = async (userId: string) =>
        expectOk(await h.repositories.userEvents.listFrom(userId, 0, 10)).map(({ type }) => type);
      expect(await told(OWNER.id)).toEqual(['comment.held']);
      expect(await told(moderatorId)).toEqual(['comment.held']);
      expect(await told(VIEWER.id)).toEqual([]);
      expect(held.status).toBe('held');
    });

    it('tells no one when a comment is published', async () => {
      expectOk(await h.create(VIEWER));

      expect(
        expectOk(await h.repositories.userEvents.listFrom(OWNER.id, 0, 10)).map(({ type }) => type)
      ).toEqual(['comment.created']);
    });
  });

  describe('a shadow ban', () => {
    const view = async (author: UserContext) => expectOk(await h.create(author, 'same words'));

    it('answers the same body as an ordinary comment and stores it as the author only sees it', async () => {
      const ordinary = await view(OTHER);
      expectOk(
        await h.repositories.channelUserRestrictions.apply({
          channelId: h.channelId,
          userId: VIEWER.id,
          kind: 'shadow',
          reason: null,
          expiresAt: null,
          createdBy: OWNER.id,
        })
      );

      const shadowed = await view(VIEWER);

      const shape = (comment: typeof shadowed) => ({
        ...comment,
        id: '',
        createdAt: '',
        updatedAt: '',
        author: { ...comment.author, userId: '' },
      });
      expect(shape(shadowed)).toEqual(shape(ordinary));
      expect(
        expectOk(await h.repositories.comments.listOwnNonPublic(VIDEO_ID, VIEWER.id))
      ).toHaveLength(1);
    });
  });

  describe('slow mode', () => {
    beforeEach(async () => {
      await h.configure({ slowModeSeconds: 30 });
    });

    it('refuses a second comment inside the window with the seconds left, replies included', async () => {
      const first = expectOk(await h.create(VIEWER));
      const slowMode = new InMemoryCommentSlowMode(h.now);
      const deps = { ...commentCreateDeps(h.repositories, h.now), slowMode };
      expectOk(await slowMode.claim(h.channelId, VIEWER.id, 30));
      h.setClock(START + 10_000);

      const failure = expectErr(
        await createComment(deps, VIEWER, VIDEO_ID, { content: 'again', parentId: first.id })
      );

      expect(failure).toMatchObject({ code: ErrorCodes.COMMENTS_SLOW_MODE, retryAfterSeconds: 20 });
    });

    it('lets the next comment through once the window ends', async () => {
      const deps = commentCreateDeps(h.repositories, h.now);
      expectOk(await createComment(deps, VIEWER, VIDEO_ID, { content: 'one' }));
      expect(expectErr(await createComment(deps, VIEWER, VIDEO_ID, { content: 'two' })).code).toBe(
        ErrorCodes.COMMENTS_SLOW_MODE
      );

      h.setClock(START + 30_000);

      expect(
        expectOk(await createComment(deps, VIEWER, VIDEO_ID, { content: 'three' })).status
      ).toBe('published');
    });

    it('exempts a member and a trusted commenter', async () => {
      expectOk(await h.repositories.trustedCommenters.add(h.channelId, VIEWER.id, OWNER.id));
      const deps = commentCreateDeps(h.repositories, h.now);

      for (const author of [VIEWER, OWNER]) {
        expectOk(await createComment(deps, author, VIDEO_ID, { content: 'one' }));
        expectOk(await createComment(deps, author, VIDEO_ID, { content: 'two' }));
      }
    });

    it('claims the window last, so a refused comment does not start it', async () => {
      await h.configure({ slowModeSeconds: 30, minAccountAgeDays: 7 });
      const deps = commentCreateDeps(h.repositories, h.now);
      expect(expectErr(await createComment(deps, VIEWER, VIDEO_ID, { content: 'a' })).code).toBe(
        ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW
      );

      await h.configure({ slowModeSeconds: 30 });

      expectOk(await createComment(deps, VIEWER, VIDEO_ID, { content: 'b' }));
    });

    it('releases the window when the comment is not stored', async () => {
      const deps = commentCreateDeps(h.repositories, h.now);
      const failing = {
        ...deps,
        comments: Object.assign(Object.create(h.repositories.comments), {
          create: async () => err(databaseUnavailable('createComment')),
        }),
      };

      expect(expectErr(await createComment(failing, VIEWER, VIDEO_ID, { content: 'a' })).code).toBe(
        ErrorCodes.DATABASE_UNAVAILABLE
      );

      expectOk(await createComment(deps, VIEWER, VIDEO_ID, { content: 'b' }));
    });

    it('fails open when the window cannot be claimed', async () => {
      const dead: CommentSlowModePort = {
        claim: async () => err(cacheUnavailable('claim')),
        release: async () => err(cacheUnavailable('release')),
      };
      const deps = { ...commentCreateDeps(h.repositories, h.now), slowMode: dead };

      expectOk(await createComment(deps, VIEWER, VIDEO_ID, { content: 'a' }));
      expectOk(await createComment(deps, VIEWER, VIDEO_ID, { content: 'b' }));
    });
  });
});
