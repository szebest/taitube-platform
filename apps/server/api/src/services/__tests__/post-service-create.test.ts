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
    ])('refuses to share $scenario in a post', async ({ make }) => {
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
});
