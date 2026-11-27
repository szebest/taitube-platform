import { expectOk } from '@kit/testing/result';
import {
  BANNER_DONE,
  DAY_MS,
  DEFAULT_URL,
  FIRST,
  POST_URLS,
  SECOND,
  THIRD,
  channelImageContractContext,
} from './channel-image-contract-context';
import type { MakeRepositoriesSubject } from './subjects';

export function describeChannelImageLifecycleContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelImageRepository post images, failures and purging', () => {
    const ctx = channelImageContractContext(makeSubject);
    const { issue, queue, channel, eventTypes, auditActions } = ctx;

    describe('post images', () => {
      it('numbers them apart from the channel images and keeps every ready one beside the others', async () => {
        await queue(FIRST, 'post-image');
        await queue(SECOND, 'post-image');
        await queue(THIRD, 'banner');

        const first = expectOk(await ctx.images.commit(FIRST, POST_URLS.w1280, POST_URLS));
        const second = expectOk(await ctx.images.commit(SECOND, POST_URLS.w1280, POST_URLS));

        expect(first).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
        expect(second).toMatchObject({ applied: true, upload: { status: 'ready', version: 2 } });
        expect(expectOk(await ctx.images.findById(THIRD))?.version).toBe(1);
        expect(await channel()).toMatchObject({
          avatarVersion: 0,
          bannerVersion: 0,
          bannerCrops: null,
          avatarUrl: null,
          bannerUrl: null,
        });
        expect(await auditActions()).toEqual([]);
        expect(await eventTypes()).toEqual(['channel.image.ready', 'channel.image.ready']);
      });

      it('is never purgeable while ready', async () => {
        await queue(FIRST, 'post-image');
        expectOk(await ctx.images.commit(FIRST, POST_URLS.w1280, POST_URLS));

        expect(expectOk(await ctx.images.listPurgeable(new Date(Date.now() + DAY_MS), 10))).toEqual(
          []
        );
      });

      it.each(['post-image', 'page-image'] as const)(
        'finds the ready %s of the channel among the ids and nothing else',
        async (kind) => {
          const otherKind = kind === 'post-image' ? 'page-image' : 'post-image';
          await queue(FIRST, kind);
          await queue(SECOND, kind);
          await queue(THIRD, otherKind);
          expectOk(await ctx.images.commit(FIRST, POST_URLS.w1280, POST_URLS));
          expectOk(await ctx.images.commit(THIRD, POST_URLS.w1280, POST_URLS));
          const missing = '00000000-0000-7000-8000-0000000004f0';

          const found = expectOk(
            await ctx.images.findReadyImages(kind, ctx.channelId, [FIRST, SECOND, THIRD, missing])
          );

          expect(found).toEqual([{ uploadId: FIRST, urls: POST_URLS }]);
          expect(expectOk(await ctx.images.findReadyImages(kind, ctx.channelId, []))).toEqual([]);
          expect(
            expectOk(
              await ctx.images.findReadyImages(kind, '00000000-0000-7000-8000-0000000004e0', [
                FIRST,
              ])
            )
          ).toEqual([]);
        }
      );
    });

    describe('fail', () => {
      it('keeps the old image, records why, tells the uploader', async () => {
        await queue(FIRST);

        const failed = expectOk(await ctx.images.fail(FIRST, 'unreadable'));

        expect(failed).toMatchObject({ status: 'failed', failure: 'unreadable' });
        expect(await channel()).toMatchObject({ bannerVersion: 0 });
        expect(await eventTypes()).toEqual(['channel.image.failed']);
      });

      it('leaves an upload that already settled as it is, and null for an unknown one', async () => {
        await queue(FIRST);
        expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await ctx.images.fail(FIRST, 'late'))).toMatchObject({
          status: 'ready',
          failure: null,
        });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
        expect(expectOk(await ctx.images.fail(THIRD, 'x'))).toBeNull();
      });
    });

    describe('purging', () => {
      const future = () => new Date(Date.now() + DAY_MS);

      it('lists replaced versions, failures and abandoned uploads, not the current image', async () => {
        await queue(FIRST);
        expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));
        await queue(SECOND);
        expectOk(await ctx.images.commit(SECOND, DEFAULT_URL));
        await queue(THIRD);
        expectOk(await ctx.images.fail(THIRD, 'bad'));

        const purgeable = expectOk(await ctx.images.listPurgeable(future(), 10));

        expect(purgeable.map(({ id }) => id).sort()).toEqual([FIRST, THIRD].sort());
      });

      it('leaves out what changed after the cutoff and honours the limit', async () => {
        await queue(FIRST);
        expectOk(await ctx.images.fail(FIRST, 'bad'));
        await queue(SECOND);
        expectOk(await ctx.images.fail(SECOND, 'bad'));

        expect(expectOk(await ctx.images.listPurgeable(new Date(0), 10))).toEqual([]);
        expect(expectOk(await ctx.images.listPurgeable(future(), 1))).toHaveLength(1);
      });

      it('stops listing an upload once it is marked purged, and accepts an empty list', async () => {
        await queue(FIRST);
        expectOk(await ctx.images.fail(FIRST, 'bad'));

        expectOk(await ctx.images.markPurged([]));
        expectOk(await ctx.images.markPurged([FIRST]));

        expect(expectOk(await ctx.images.listPurgeable(future(), 10))).toEqual([]);
        expect(expectOk(await ctx.images.findById(FIRST))?.status).toBe('purged');
      });

      it('leaves an upload that moved on since it was listed, and the live image', async () => {
        await issue(FIRST);
        await queue(SECOND);
        expectOk(await ctx.images.commit(SECOND, DEFAULT_URL));
        await ctx.images.queue(FIRST, BANNER_DONE);

        expectOk(await ctx.images.markPurged([FIRST, SECOND]));

        expect(expectOk(await ctx.images.findById(FIRST))?.status).toBe('queued');
        expect(expectOk(await ctx.images.findById(SECOND))?.status).toBe('ready');
      });
    });
  });
}
