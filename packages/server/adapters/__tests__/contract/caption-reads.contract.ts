import { expectOk } from '@vp/testing/result';
import {
  ABSENT_ID,
  CHANNEL_ID,
  captionContractContext,
  generated,
  ready,
  upload,
} from './caption-contract-context';
import { OWNER_ID, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';

export function describeCaptionReadsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('CaptionRepository reads and switches', () => {
    const ctx = captionContractContext(makeSubject);

    it.each([
      { query: undefined, indexes: [0, 1, 2] },
      { query: 'bread', indexes: [1, 2] },
      { query: 'bread flour', indexes: [2] },
      { query: 'missing', indexes: [] },
    ])('lists cues in order, filtered by the words of $query', async ({ query, indexes }) => {
      const track = await ready(ctx);

      const found = expectOk(await ctx.captions.cues(track.id, query));

      expect(found.map((cue) => cue.index)).toEqual(indexes);
    });

    it.each([
      { olderThanMs: -1, found: true },
      { olderThanMs: 3_600_000, found: false },
    ])(
      'lists generated pending tracks idle for $olderThanMs ms: $found',
      async ({ olderThanMs, found }) => {
        await upload(ctx, 'pl');
        const pending = await generated(ctx);

        const stale = expectOk(await ctx.captions.listStalePending(olderThanMs, 10));

        expect(stale).toEqual(found ? [pending] : []);
      }
    );

    it('leaves finished and disabled tracks out of the stale list', async () => {
      await ready(ctx);

      expect(expectOk(await ctx.captions.listStalePending(-1, 10))).toEqual([]);
    });

    it('reads the switches, falling back to a channel default of false without a channel', async () => {
      expect(expectOk(await ctx.captions.settings(VIDEO_IDS.a))).toEqual({
        videoId: VIDEO_IDS.a,
        ownerId: OWNER_ID,
        autoCaptions: null,
        channelDefault: false,
      });
      expect(expectOk(await ctx.captions.settings(ABSENT_ID))).toBeNull();
      expect(expectOk(await ctx.captions.setAutoCaptions(VIDEO_IDS.a, true))).toBe(true);
      expect(expectOk(await ctx.captions.setAutoCaptions(ABSENT_ID, true))).toBe(false);
      expect(expectOk(await ctx.captions.settings(VIDEO_IDS.a))).toMatchObject({
        autoCaptions: true,
      });
      expect(expectOk(await ctx.captions.setAutoCaptions(VIDEO_IDS.a, null))).toBe(true);
      expect(expectOk(await ctx.captions.settings(VIDEO_IDS.a))).toMatchObject({
        autoCaptions: null,
      });
    });

    it('sets the channel default of an owner who has a channel only', async () => {
      expect(expectOk(await ctx.captions.setChannelDefault(OWNER_ID, true))).toBe(false);

      expectOk(
        await ctx.subject.repositories.channels.create({
          id: CHANNEL_ID,
          userId: OWNER_ID,
          handle: 'owner',
          displayName: 'Owner',
        })
      );

      expect(expectOk(await ctx.captions.setChannelDefault(OWNER_ID, true))).toBe(true);
      expect(expectOk(await ctx.captions.settings(VIDEO_IDS.a))).toMatchObject({
        channelDefault: true,
      });
      expect(expectOk(await ctx.captions.setChannelDefault(OWNER_ID, false))).toBe(true);
      expect(expectOk(await ctx.captions.settings(VIDEO_IDS.a))).toMatchObject({
        channelDefault: false,
      });
    });

    it('deletes a track with its cues, once', async () => {
      const track = await ready(ctx);

      expect(expectOk(await ctx.captions.delete(track.id))).toBe(true);
      expect(expectOk(await ctx.captions.delete(track.id))).toBe(false);
      expect(expectOk(await ctx.captions.findById(track.id))).toBeNull();
      expect(expectOk(await ctx.captions.cues(track.id))).toEqual([]);
    });
  });
}
