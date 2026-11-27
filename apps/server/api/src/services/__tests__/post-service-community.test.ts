import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ABSENT, EDITOR_ID, MODERATOR_ID, STRANGER, member, postsFixture } from './post-deps';

const TEXT = (text: string): PostPayload => ({ kind: 'text', text });

describe('apps/server/api/services: PostService', () => {
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
