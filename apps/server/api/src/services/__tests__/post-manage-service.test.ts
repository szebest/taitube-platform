import { expectErr, expectOk } from '@kit/testing/result';
import type { ActingChannel } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { EDITOR_ID, MODERATOR_ID, OWNER, STRANGER, member, postsFixture } from './post-deps';

async function fixtureWithPosts() {
  const fixture = await postsFixture();
  const { service, acting, publish } = fixture;
  const draft = expectOk(
    await service.create(OWNER, acting, {
      payload: { kind: 'text', text: 'draft' },
      commentsEnabled: true,
      timing: { mode: 'draft' },
    })
  );
  const posts = [await publish(), await publish(), await publish(), await publish()];
  return { ...fixture, draft, posts };
}

describe('apps/server/api/services: PostManageService', () => {
  describe('list', () => {
    it('lists every status of the channel, filters by status and pages by cursor', async () => {
      const { manage, acting, draft, posts } = await fixtureWithPosts();

      const all = expectOk(await manage.list(OWNER, acting, {}));
      const drafts = expectOk(await manage.list(OWNER, acting, { status: 'draft' }));
      const first = expectOk(await manage.list(OWNER, acting, { limit: 2 }));
      const second = expectOk(
        await manage.list(OWNER, acting, { limit: 2, cursor: first.nextCursor ?? undefined })
      );

      expect(all.items).toHaveLength(5);
      expect(drafts.items.map((post) => post.id)).toEqual([draft.id]);
      expect([first.items.length, first.nextCursor === null]).toEqual([2, false]);
      expect(new Set([...first.items, ...second.items].map((post) => post.id)).size).toBe(4);
      expect(all.items.map((post) => post.id)).toContain(posts[0]?.id);
    });

    it.each([
      { who: 'a stranger', role: null },
      { who: 'a moderator', role: 'moderator' as const },
    ])('refuses $who', async ({ role }) => {
      const { manage, acting } = await postsFixture();
      const user = role ? member(MODERATOR_ID, acting.channelId, role) : STRANGER;

      expect(expectErr(await manage.list(user, acting, {})).code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('refuses a cursor that is not one', async () => {
      const { manage, acting } = await postsFixture();

      expect(expectErr(await manage.list(OWNER, acting, { cursor: 'nope' })).code).toBe(
        ErrorCodes.INVALID_CURSOR
      );
    });
  });

  describe('pin', () => {
    it('pins newest first, refuses the fourth with POST_PIN_LIMIT and unpins idempotently', async () => {
      const { manage, service, acting, posts } = await fixtureWithPosts();
      const [a, b, c, d] = posts;
      if (!(a && b && c && d)) throw new Error('four posts');

      expectOk(await manage.pin(OWNER, acting, a.id));
      expectOk(await manage.pin(OWNER, acting, b.id));
      const third = expectOk(await manage.pin(OWNER, acting, c.id));
      const fourth = expectErr(await manage.pin(OWNER, acting, d.id));
      const unpinned = expectOk(await manage.unpin(OWNER, acting, a.id));
      const again = expectOk(await manage.unpin(OWNER, acting, a.id));
      expectOk(await manage.pin(OWNER, acting, d.id));

      expect(third.pinned).toBe(true);
      expect(fourth).toMatchObject({ code: ErrorCodes.POST_PIN_LIMIT, limit: 3 });
      expect([unpinned.pinned, again.pinned]).toEqual([false, false]);
      const listed = expectOk(await service.listByChannel(null, acting.channelId, {}));
      expect(listed.items.slice(0, 3).map((post) => post.id)).toEqual([d.id, c.id, b.id]);
    });

    it('lets an editor pin, refuses a moderator, and treats a draft and another channel as absent', async () => {
      const { manage, acting, draft, posts, repositories } = await fixtureWithPosts();
      const editor = member(EDITOR_ID, acting.channelId, 'editor');
      const moderator = member(MODERATOR_ID, acting.channelId, 'moderator');
      const elsewhere = expectOk(
        await repositories.channels.createOwned(
          { userId: STRANGER.id, handle: 'elsewhere', displayName: 'Elsewhere' },
          5
        )
      );
      const strangerActing: ActingChannel = {
        channelId: elsewhere.id,
        ownerId: STRANGER.id,
        role: 'owner',
      };

      expectOk(await manage.pin(editor, acting, posts[0]?.id ?? ''));
      expect(expectErr(await manage.pin(moderator, acting, posts[1]?.id ?? '')).code).toBe(
        ErrorCodes.FORBIDDEN
      );
      expect(expectErr(await manage.pin(OWNER, acting, draft.id)).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
      expect(expectErr(await manage.pin(STRANGER, strangerActing, posts[1]?.id ?? '')).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
    });
  });

  describe('stats', () => {
    it.each([
      { who: 'the owner', user: OWNER, ok: true },
      { who: 'a stranger', user: STRANGER, ok: false },
    ])('answers $who: $ok', async ({ user, ok }) => {
      const { manage, acting, posts } = await fixtureWithPosts();

      const result = await manage.stats(user, acting, posts[0]?.id ?? '');

      expect(result.ok).toBe(ok);
    });

    it('lets the analytics role read and a moderator not, and never reads another channel', async () => {
      const { manage, acting, posts } = await fixtureWithPosts();
      const analytics = member(
        '00000000-0000-7000-8000-000000001205',
        acting.channelId,
        'analytics'
      );
      const moderator = member(MODERATOR_ID, acting.channelId, 'moderator');
      const id = posts[0]?.id ?? '';

      expect(expectOk(await manage.stats(analytics, acting, id))).toMatchObject({
        opens: 0,
        likes: 0,
      });
      expect(expectErr(await manage.stats(moderator, acting, id)).code).toBe(ErrorCodes.FORBIDDEN);
      expect(
        expectErr(await manage.stats(OWNER, acting, '00000000-0000-7000-8000-0000000012aa')).code
      ).toBe(ErrorCodes.POST_NOT_FOUND);
    });
  });
});
