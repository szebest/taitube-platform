import { cacheUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ABSENT, MODERATOR_ID, OWNER, STRANGER, member, postsFixture } from './post-deps';

const TEXT = (text: string): PostPayload => ({ kind: 'text', text });

describe('apps/server/api/services: PostService', () => {
  describe('get and list', () => {
    it('reads a published post with the like of the reader', async () => {
      const { service, publish } = await postsFixture();
      const { id } = await publish();
      expectOk(await service.setLiked(STRANGER, id, true));

      const anonymous = expectOk(await service.get(null, id));
      const liker = expectOk(await service.get(STRANGER, id));

      expect([anonymous.likedByViewer, liker.likedByViewer]).toEqual([false, true]);
      expect(liker.likeCount).toBe(1);
    });

    it('answers POST_NOT_FOUND for a post that is not there', async () => {
      const { service } = await postsFixture();

      expect(expectErr(await service.get(null, ABSENT)).code).toBe(ErrorCodes.POST_NOT_FOUND);
    });

    it('turns a shared video that went private into an unavailable card with nothing of it', async () => {
      const { service, repositories, video, publish } = await postsFixture();
      const videoId = await video();
      const { id } = await publish({ kind: 'video_share', videoId, comment: 'watch', startMs: 5 });
      const stored = expectOk(await repositories.videos.findById(videoId));
      if (stored) stored.visibility = 'private';

      const view = expectOk(await service.get(null, id));

      expect(view.body).toEqual({
        kind: 'video_share',
        comment: 'watch',
        startMs: 5,
        card: { type: 'unavailable' },
      });
    });

    it('pages a channel newest first and walks the cursor to the end', async () => {
      const { service, channel, publish } = await postsFixture();
      const ids = [];
      for (const text of ['one', 'two', 'three']) {
        ids.push((await publish(TEXT(text))).id);
      }

      const first = expectOk(await service.listByChannel(null, 'owner', { limit: 2 }));
      const second = expectOk(
        await service.listByChannel(null, channel.id, { limit: 2, cursor: first.nextCursor ?? '' })
      );

      expect(first.items.map(({ id }) => id)).toEqual([ids[2], ids[1]]);
      expect(second.items.map(({ id }) => id)).toEqual([ids[0]]);
      expect(second.nextCursor).toBeNull();
    });

    it.each([
      {
        scenario: 'an unknown channel',
        call: (s: Awaited<ReturnType<typeof postsFixture>>['service']) =>
          s.listByChannel(null, 'nobody', {}),
        code: ErrorCodes.CHANNEL_NOT_FOUND,
      },
      {
        scenario: 'a broken cursor',
        call: (s: Awaited<ReturnType<typeof postsFixture>>['service']) =>
          s.listByChannel(null, 'owner', { cursor: '!!' }),
        code: ErrorCodes.INVALID_CURSOR,
      },
    ])('refuses $scenario', async ({ call, code }) => {
      const { service } = await postsFixture();

      expect(expectErr(await call(service)).code).toBe(code);
    });
  });

  describe('edit', () => {
    it('replaces the payload, moves the version on and marks the post edited', async () => {
      const { service, acting, channel, repositories, publish } = await postsFixture();
      const { id } = await publish();

      const view = expectOk(
        await service.edit(OWNER, acting, id, { payload: TEXT('better'), version: 1 })
      );

      expect(view).toMatchObject({
        body: { text: 'better' },
        isEdited: true,
        version: 2,
        commentsEnabled: true,
      });
      expect(
        expectOk(await repositories.channelAudit.list(channel.id, { cursor: null, limit: 5 }))[0]
      ).toMatchObject({ action: 'post.updated', targetId: id });
    });

    it.each([true, false])(
      'keeps the replies switch at %s when the edit does not name it',
      async (enabled) => {
        const { service, acting } = await postsFixture();
        const { id } = expectOk(
          await service.create(OWNER, acting, { payload: TEXT('x'), commentsEnabled: enabled })
        );

        const view = expectOk(
          await service.edit(OWNER, acting, id, { payload: TEXT('y'), version: 1 })
        );

        expect(view.commentsEnabled).toBe(enabled);
      }
    );

    it('answers VERSION_CONFLICT for a stale version', async () => {
      const { service, acting, publish } = await postsFixture();
      const { id } = await publish();
      expectOk(await service.edit(OWNER, acting, id, { payload: TEXT('b'), version: 1 }));

      const failure = expectErr(
        await service.edit(OWNER, acting, id, { payload: TEXT('c'), version: 1 })
      );

      expect(failure).toMatchObject({ code: ErrorCodes.VERSION_CONFLICT, expectedVersion: 1 });
    });

    it('answers POST_NOT_FOUND for a post of another channel, whatever the caller may do', async () => {
      const { service, acting, repositories, publish } = await postsFixture();
      const { id } = await publish();
      const other = expectOk(
        await repositories.channels.create({
          userId: STRANGER.id,
          handle: 'other',
          displayName: 'Other',
        })
      );
      const otherActing = { channelId: other.id, ownerId: STRANGER.id, role: 'owner' as const };

      const failure = expectErr(
        await service.edit(STRANGER, otherActing, id, { payload: TEXT('mine now'), version: 1 })
      );

      expect(failure.code).toBe(ErrorCodes.POST_NOT_FOUND);
      expect(acting.channelId).not.toBe(other.id);
    });

    it('refuses a moderator before it says whether the post exists', async () => {
      const { service, acting, channel } = await postsFixture();

      const failure = expectErr(
        await service.edit(member(MODERATOR_ID, channel.id, 'moderator'), acting, ABSENT, {
          payload: TEXT('x'),
          version: 1,
        })
      );

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
    });
  });

  describe('remove', () => {
    it('deletes the post, audits it and drops the hot comments of the post', async () => {
      const { service, acting, channel, repositories, commentCache, publish } =
        await postsFixture();
      const { id } = await publish();

      expectOk(await service.remove(OWNER, acting, id));

      expect(expectErr(await service.get(null, id)).code).toBe(ErrorCodes.POST_NOT_FOUND);
      expect(commentCache.invalidate).toHaveBeenCalledWith({ type: 'post', id });
      expect(
        expectOk(await repositories.channelAudit.list(channel.id, { cursor: null, limit: 5 }))[0]
      ).toMatchObject({ action: 'post.deleted', targetId: id, meta: { kind: 'text' } });
    });

    it('still deletes when the cache cannot be reached', async () => {
      const { service, acting, commentCache, publish } = await postsFixture();
      const { id } = await publish();
      vi.spyOn(commentCache, 'invalidate').mockResolvedValue(err(cacheUnavailable('invalidate')));

      expectOk(await service.remove(OWNER, acting, id));

      expect(expectErr(await service.get(null, id)).code).toBe(ErrorCodes.POST_NOT_FOUND);
    });

    it('answers POST_NOT_FOUND for a post that is not there', async () => {
      const { service, acting } = await postsFixture();

      expect(expectErr(await service.remove(OWNER, acting, ABSENT)).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
    });

    it('refuses a moderator and leaves the post', async () => {
      const { service, acting, channel, publish } = await postsFixture();
      const { id } = await publish();

      const failure = expectErr(
        await service.remove(member(MODERATOR_ID, channel.id, 'moderator'), acting, id)
      );

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
      expectOk(await service.get(null, id));
    });
  });
});
