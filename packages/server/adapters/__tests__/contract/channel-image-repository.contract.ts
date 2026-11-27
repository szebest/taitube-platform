import { expectOk } from '@kit/testing/result';
import {
  AVATAR_DONE,
  BANNER_CROPS,
  BANNER_DONE,
  DAY_MS,
  DEFAULT_URL,
  FIRST,
  SECOND,
  THIRD,
  channelImageContractContext,
} from './channel-image-contract-context';
import { describeChannelImageLifecycleContract } from './channel-image-lifecycle.contract';
import { OTHER_OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';

export function describeChannelImageRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelImageRepository contract', () => {
    const ctx = channelImageContractContext(makeSubject);
    const { issue, queue, channel, eventTypes, auditActions } = ctx;

    it('records an issued upload with nothing decided about it yet', async () => {
      expect(await issue(FIRST)).toMatchObject({
        id: FIRST,
        channelId: ctx.channelId,
        kind: 'banner',
        status: 'issued',
        version: null,
        variantUrls: null,
        crops: null,
        failure: null,
      });
      expect(expectOk(await ctx.images.findById(FIRST))?.id).toBe(FIRST);
      expect(expectOk(await ctx.images.findById(SECOND))).toBeNull();
    });

    describe('queue', () => {
      it('stores dimensions and crops, numbering each kind after its newest version', async () => {
        expect(await queue(FIRST)).toMatchObject({
          status: 'queued',
          width: 2560,
          height: 1440,
          crops: { kind: 'banner', crops: BANNER_CROPS },
          version: 1,
        });
        expect(await queue(SECOND)).toMatchObject({ version: 2 });
        expect(await queue(THIRD, 'avatar')).toMatchObject({ version: 1 });
      });

      it('repeats the version for a second call, and answers null once moved on or missing', async () => {
        await queue(FIRST);

        const again = expectOk(await ctx.images.queue(FIRST, { ...BANNER_DONE, width: 9999 }));

        expect(again).toMatchObject({ status: 'queued', version: 1, width: 2560 });

        expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

        expect(expectOk(await ctx.images.queue(SECOND, BANNER_DONE))).toBeNull();
        expect(expectOk(await ctx.images.queue(FIRST, BANNER_DONE))).toBeNull();
      });
    });

    describe('commit', () => {
      it.each([
        {
          kind: 'banner',
          moved: { bannerVersion: 1, bannerCrops: BANNER_CROPS, avatarVersion: 0 },
        },
        { kind: 'avatar', moved: { avatarVersion: 1, bannerVersion: 0, bannerCrops: null } },
      ] as const)(
        'moves the channel to the $kind version alone, announcing and auditing it',
        async ({ kind, moved }) => {
          await queue(FIRST, kind);

          const commit = expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

          expect(commit).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
          expect(await channel()).toMatchObject(moved);
          expect(await eventTypes()).toEqual(['channel.image.ready']);
          expect(await auditActions()).toEqual(['channel.updated']);
        }
      );

      it('readies every playlist cover beside the others, moving and auditing nothing', async () => {
        await queue(FIRST, 'playlist-cover');
        await queue(SECOND, 'playlist-cover');

        expectOk(await ctx.images.commit(SECOND, DEFAULT_URL));
        const earlier = expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

        expect(earlier).toMatchObject({ applied: true, upload: { status: 'ready', version: 1 } });
        expect(await channel()).toMatchObject({ avatarVersion: 0, bannerVersion: 0 });
        expect(await eventTypes()).toEqual(['channel.image.ready', 'channel.image.ready']);
        expect(await auditActions()).toEqual([]);
        expect(expectOk(await ctx.images.listPurgeable(new Date(Date.now() + DAY_MS), 10))).toEqual(
          []
        );
      });

      it('repeats its outcome for a committed upload and announces nothing more', async () => {
        await queue(FIRST);
        expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

        const again = expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

        expect(again).toMatchObject({ applied: true, upload: { status: 'ready' } });
        expect(await eventTypes()).toEqual(['channel.image.ready']);
        expect(await auditActions()).toEqual(['channel.updated']);
      });

      it('never brings back an older version: the late one is superseded silently', async () => {
        await queue(FIRST);
        await queue(SECOND);
        expectOk(await ctx.images.commit(SECOND, DEFAULT_URL));

        const late = expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

        expect(late).toMatchObject({ applied: false, upload: { status: 'superseded' } });
        expect((await channel())?.bannerVersion).toBe(2);
        expect(await eventTypes()).toEqual(['channel.image.ready']);
      });

      it.each([
        { scenario: 'an unknown upload', prepare: async () => THIRD },
        {
          scenario: 'an upload never queued',
          prepare: async () => {
            await issue(FIRST);
            return FIRST;
          },
        },
      ])('answers null for $scenario', async ({ prepare }) => {
        expect(expectOk(await ctx.images.commit(await prepare(), DEFAULT_URL))).toBeNull();
      });
    });

    it('keeps a team uploader apart from the owner', async () => {
      await ctx.repositories.users.upsert({
        id: OTHER_OWNER_ID,
        email: 'other@video-pipeline.local',
      });
      await issue(FIRST, 'avatar', OTHER_OWNER_ID);
      expectOk(await ctx.images.queue(FIRST, AVATAR_DONE));

      expectOk(await ctx.images.commit(FIRST, DEFAULT_URL));

      const told = expectOk(await ctx.repositories.userEvents.listFrom(OTHER_OWNER_ID, 0, 10));
      expect(told.map(({ type }) => type)).toEqual(['channel.image.ready']);
      expect(await eventTypes()).toEqual([]);
    });
  });

  describeChannelImageLifecycleContract(makeSubject);
}
