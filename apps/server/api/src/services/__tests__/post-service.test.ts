import { MS_PER_DAY } from '@kit/primitives';
import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  EDITOR_ID,
  MODERATOR_ID,
  NOW,
  OWNER,
  STRANGER,
  member,
  postsFixture,
} from './post-deps';

const TEXT = (text: string): PostPayload => ({ kind: 'text', text });

describe('apps/server/api/services: PostService', () => {
  describe('create', () => {
    it.each([
      {
        scenario: 'a text post',
        payload: async () => TEXT('  hello  '),
        body: { kind: 'text', text: 'hello' },
      },
      {
        scenario: 'a post of images, in the order given',
        payload: async (f: Awaited<ReturnType<typeof postsFixture>>) => ({
          kind: 'images' as const,
          images: [
            { uploadId: await f.readyImage(), alt: 'one' },
            { uploadId: await f.readyImage(), alt: 'two' },
          ],
          caption: '  look  ',
        }),
        body: { kind: 'images', caption: 'look' },
      },
      {
        scenario: 'a shared video at a moment',
        payload: async (f: Awaited<ReturnType<typeof postsFixture>>) => ({
          kind: 'video_share' as const,
          videoId: await f.video(),
          comment: null,
          startMs: 1500,
        }),
        body: { kind: 'video_share', startMs: 1500, card: { type: 'video', title: 'A video' } },
      },
      {
        scenario: 'a shared playlist',
        payload: async (f: Awaited<ReturnType<typeof postsFixture>>) => ({
          kind: 'playlist_share' as const,
          playlistId: await f.playlist(),
          comment: 'a good one',
        }),
        body: {
          kind: 'playlist_share',
          comment: 'a good one',
          card: { type: 'playlist', title: 'A playlist', itemCount: 0 },
        },
      },
    ])('publishes $scenario as the channel', async ({ payload, body }) => {
      const fixture = await postsFixture();
      const { service, acting, channel, repositories } = fixture;

      const view = expectOk(
        await service.create(OWNER, acting, {
          payload: await payload(fixture),
          commentsEnabled: true,
        })
      );

      expect(view).toMatchObject({
        kind: body.kind,
        body,
        channel: { id: channel.id, handle: 'owner' },
        commentsEnabled: true,
        likeCount: 0,
        commentsCount: 0,
        likedByViewer: false,
        isEdited: false,
        version: 1,
      });
      expect(
        expectOk(await repositories.channelAudit.list(channel.id, { cursor: null, limit: 5 }))
      ).toMatchObject([{ action: 'post.published', targetId: view.id, meta: { kind: body.kind } }]);
    });

    it('lists the images in the order given', async () => {
      const fixture = await postsFixture();
      const uploads = [await fixture.readyImage(), await fixture.readyImage()];

      const view = await fixture.publish({
        kind: 'images',
        images: uploads.map((uploadId) => ({ uploadId, alt: 'x' })),
        caption: null,
      });

      expect(view.body).toMatchObject({ images: uploads.map((uploadId) => ({ uploadId })) });
    });

    it('turns a team member post into the channel post without naming the member', async () => {
      const { service, acting, channel } = await postsFixture();
      const editor = member(EDITOR_ID, channel.id, 'editor');

      const view = expectOk(
        await service.create(editor, acting, {
          payload: TEXT('from the team'),
          commentsEnabled: true,
        })
      );

      expect(view.channel.id).toBe(channel.id);
      expect(JSON.stringify(view)).not.toContain(EDITOR_ID);
      expect(JSON.stringify(view)).not.toContain('authorUserId');
    });

    it.each([
      {
        scenario: 'a moderator',
        user: (channelId: string) => member(MODERATOR_ID, channelId, 'moderator'),
      },
      { scenario: 'a stranger', user: () => STRANGER },
    ])('refuses $scenario with FORBIDDEN', async ({ user }) => {
      const { service, acting, channel } = await postsFixture();

      const failure = expectErr(
        await service.create(user(channel.id), acting, {
          payload: TEXT('no'),
          commentsEnabled: true,
        })
      );

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it.each([
      {
        scenario: 'a private video',
        make: (f: Awaited<ReturnType<typeof postsFixture>>) => f.video('private'),
      },
      {
        scenario: 'an unlisted video',
        make: (f: Awaited<ReturnType<typeof postsFixture>>) => f.video('unlisted'),
      },
      {
        scenario: 'a video still processing',
        make: (f: Awaited<ReturnType<typeof postsFixture>>) => f.video('public', 'PROCESSING'),
      },
      { scenario: 'a video that is not there', make: async () => ABSENT },
    ])('refuses to share $scenario', async ({ make }) => {
      const fixture = await postsFixture();
      const videoId = await make(fixture);

      const failure = expectErr(
        await fixture.service.create(OWNER, fixture.acting, {
          payload: { kind: 'video_share', videoId, comment: null, startMs: null },
          commentsEnabled: true,
        })
      );

      expect(failure.code).toBe(ErrorCodes.POST_SHARE_NOT_PUBLIC);
    });

    it.each([
      {
        scenario: 'a private playlist',
        make: (f: Awaited<ReturnType<typeof postsFixture>>) => f.playlist('private'),
      },
      {
        scenario: 'an unlisted playlist',
        make: (f: Awaited<ReturnType<typeof postsFixture>>) => f.playlist('unlisted'),
      },
      { scenario: 'a playlist that is not there', make: async () => ABSENT },
    ])('refuses to share $scenario', async ({ make }) => {
      const fixture = await postsFixture();
      const playlistId = await make(fixture);

      const failure = expectErr(
        await fixture.service.create(OWNER, fixture.acting, {
          payload: { kind: 'playlist_share', playlistId, comment: null },
          commentsEnabled: true,
        })
      );

      expect(failure.code).toBe(ErrorCodes.POST_SHARE_NOT_PUBLIC);
    });

    it('refuses text that is blank once trimmed', async () => {
      const { service, acting } = await postsFixture();

      const failure = expectErr(
        await service.create(OWNER, acting, { payload: TEXT('   '), commentsEnabled: true })
      );

      expect(failure.code).toBe(ErrorCodes.VALIDATION_FAILED);
    });

    it('lets the twentieth post of the UTC day through and refuses the twenty-first', async () => {
      const { service, acting } = await postsFixture();
      for (let count = 1; count <= 20; count += 1) {
        expectOk(
          await service.create(OWNER, acting, { payload: TEXT(`#${count}`), commentsEnabled: true })
        );
      }

      const failure = expectErr(
        await service.create(OWNER, acting, { payload: TEXT('#21'), commentsEnabled: true })
      );

      expect(failure).toMatchObject({ code: ErrorCodes.POST_DAILY_LIMIT, limit: 20 });
    });

    it('counts a new day from midnight UTC', async () => {
      let now = NOW;
      const { service, acting } = await postsFixture(() => now);
      for (let count = 1; count <= 20; count += 1) {
        expectOk(
          await service.create(OWNER, acting, { payload: TEXT(`#${count}`), commentsEnabled: true })
        );
      }

      now = Math.floor(NOW / MS_PER_DAY) * MS_PER_DAY - 1;
      const yesterday = expectErr(
        await service.create(OWNER, acting, { payload: TEXT('late'), commentsEnabled: true })
      );

      expect(yesterday.code).toBe(ErrorCodes.POST_DAILY_LIMIT);
    });
  });

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
      vi.mocked(commentCache.invalidate).mockResolvedValue({
        ok: false,
        error: { code: ErrorCodes.CACHE_UNAVAILABLE, message: 'down' },
      } as never);

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

  describe('likes', () => {
    it('counts a like once however often it is sent, and takes it back once', async () => {
      const { service, publish } = await postsFixture();
      const { id } = await publish();

      const counts = [];
      for (const liked of [true, true, false, false]) {
        const { likeCount, liked: state } = expectOk(await service.setLiked(STRANGER, id, liked));
        counts.push([state, likeCount]);
      }

      expect(counts).toEqual([
        [true, 1],
        [true, 1],
        [false, 0],
        [false, 0],
      ]);
    });

    it('answers POST_NOT_FOUND for a post that is not there', async () => {
      const { service } = await postsFixture();

      expect(expectErr(await service.setLiked(STRANGER, ABSENT, true)).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
    });
  });

  describe('communityFeed', () => {
    it('shows the posts of subscribed channels only, newest first, with the like of the reader', async () => {
      const { service, repositories, publish, channel } = await postsFixture();
      const { id } = await publish(TEXT('followed'));
      const fan = expectOk(
        await repositories.channels.create({
          userId: STRANGER.id,
          handle: 'fan',
          displayName: 'Fan',
        })
      );
      const elsewhere = expectOk(
        await repositories.channels.create({
          userId: EDITOR_ID,
          handle: 'elsewhere',
          displayName: 'E',
        })
      );
      expectOk(
        await repositories.channelPosts.publish(
          {
            id: ABSENT,
            channelId: elsewhere.id,
            authorUserId: EDITOR_ID,
            payload: TEXT('not followed'),
            commentsEnabled: true,
          },
          {
            channelId: elsewhere.id,
            actorUserId: EDITOR_ID,
            action: 'post.published',
            targetType: 'post',
            targetId: ABSENT,
            meta: { kind: 'text' },
          }
        )
      );
      expectOk(await repositories.subscriptions.subscribe(STRANGER.id, fan.id, channel.id));
      expectOk(await service.setLiked(STRANGER, id, true));

      const feed = expectOk(
        await service.communityFeed(
          STRANGER,
          { channelId: fan.id, ownerId: STRANGER.id, role: 'owner' },
          {}
        )
      );

      expect(feed.items).toMatchObject([{ id, likedByViewer: true, channel: { handle: 'owner' } }]);
    });

    it('refuses a member who may not act as the channel', async () => {
      const { service, acting, channel } = await postsFixture();

      const failure = expectErr(
        await service.communityFeed(member(MODERATOR_ID, channel.id, 'moderator'), acting, {})
      );

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
    });
  });
});
