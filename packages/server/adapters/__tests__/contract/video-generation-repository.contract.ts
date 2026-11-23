import { expectOk } from '@kit/testing/result';
import { EDIT_BASE_RETENTION_MS, RETIRED_GENERATION_GRACE_MS } from '@vp/domain';
import { OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';
import {
  CHAPTERS,
  NOW,
  TOKEN,
  VIDEO,
  chaptersOf,
  curveOf,
  edit,
  outboxRow,
  playback,
  render,
  rowOf,
  seedRetention,
  video,
  videoGenerationContractContext,
} from './video-generation-contract-context';
import { describeVideoGenerationRevertContract } from './video-generation-revert.contract';

const STALE = '00000000-0000-7000-8000-0000000000e2';

export function describeVideoGenerationRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoGenerationRepository contract', () => {
    const ctx = videoGenerationContractContext(makeSubject);
    const replacedEvents = async () =>
      expectOk(await ctx.subject.repositories.events.findByVideoId(VIDEO)).filter(
        ({ type }) => type === 'video.replaced'
      );
    const announced = async () =>
      expectOk(await ctx.subject.repositories.userEvents.listFrom(OWNER_ID, 0, 100))
        .filter(({ type }) => type === 'video.generation.updated')
        .map(({ payload }) => payload);
    const replace = async (generation: number) => {
      expectOk(
        await ctx.generations.openReplacement({
          videoId: VIDEO,
          generation,
          replacesGeneration: (await video(ctx)).generation,
          sourceKey: `raw/${VIDEO}/g${generation}/source.mp4`,
          uploadExpiresAt: new Date(NOW.getTime() + 3_600_000),
        })
      );
      expectOk(await ctx.generations.startRender(VIDEO, generation, outboxRow(generation)));
    };

    it('holds one replacement in flight per video and moves it to rendering once', async () => {
      await replace(2);

      expect(
        expectOk(
          await ctx.generations.openReplacement({
            videoId: VIDEO,
            generation: 3,
            replacesGeneration: 1,
            sourceKey: 'raw/x',
            uploadExpiresAt: NOW,
          })
        )
      ).toBe(false);
      expect(expectOk(await ctx.generations.startRender(VIDEO, 2, outboxRow(2)))).toBe(false);
      expect(await rowOf(ctx, 2)).toMatchObject({ kind: 'replacement', status: 'rendering' });
    });

    it('swaps a rendered replacement in once, keeping the old one for players that hold it', async () => {
      await replace(2);
      const before = await video(ctx);

      expect(await render(ctx, 2, 300_000)).toEqual({
        type: 'swapped',
        version: before.version + 1,
      });
      expect(await video(ctx)).toMatchObject({
        generation: 2,
        version: before.version + 1,
        masterPlaylistKey: playback(2).masterPlaylistKey,
        durationMs: 300_000,
        viewsCount: before.viewsCount,
      });
      expect(await rowOf(ctx, 2)).toMatchObject({ status: 'active', needsReview: true });
      expect(await rowOf(ctx, 1)).toMatchObject({
        status: 'retired',
        playback: { masterPlaylistKey: before.masterPlaylistKey, durationMs: 240_000 },
        purgeAfter: new Date(NOW.getTime() + RETIRED_GENERATION_GRACE_MS),
      });
      expect(await render(ctx, 2)).toEqual({ type: 'fenced' });
      expect(await replacedEvents()).toHaveLength(1);
      expect(await announced()).toEqual([{ videoId: VIDEO, generation: 2, status: 'active' }]);
    });

    it('fences a render whose claim was taken over, and supersedes one the video moved past', async () => {
      await replace(2);
      expectOk(await ctx.generations.claim(VIDEO, 2, STALE));
      expectOk(await ctx.generations.claim(VIDEO, 2, TOKEN));
      const stale = await ctx.generations.swap({
        videoId: VIDEO,
        generation: 2,
        claim: { type: 'render', lockToken: STALE, playback: playback(2) },
        now: NOW,
      });
      expect(expectOk(stale)).toEqual({ type: 'fenced' });

      expectOk(
        await ctx.subject.repositories.videos.transition({ videoId: VIDEO, edge: 'reprocess' })
      );
      expect(await render(ctx, 2)).toEqual({ type: 'superseded' });
      expect(await video(ctx)).toMatchObject({ generation: 1 });
      expect(await replacedEvents()).toHaveLength(0);
    });

    it('fails an in-flight generation and leaves the video alone', async () => {
      await replace(2);
      const before = await video(ctx);

      expect(expectOk(await ctx.generations.fail(VIDEO, 2, 'CORRUPT_CONTAINER'))).toBe(true);
      expect(expectOk(await ctx.generations.fail(VIDEO, 2, 'CORRUPT_CONTAINER'))).toBe(false);
      expect(await rowOf(ctx, 2)).toMatchObject({
        status: 'failed',
        errorCode: 'CORRUPT_CONTAINER',
      });
      expect(await video(ctx)).toEqual(before);
      expect(await announced()).toEqual([{ videoId: VIDEO, generation: 2, status: 'failed' }]);
    });

    it('renders an edit onto the shifted timeline, keeping its base to revert to', async () => {
      await seedRetention(ctx);
      await edit(ctx, 2);

      expect(await render(ctx, 2, 210_000)).toMatchObject({ type: 'swapped' });
      const starts = (await chaptersOf(ctx))?.map(({ startMs }) => startMs);
      expect(starts).toEqual([0, 30_000, 90_000, 150_000]);
      expect(await rowOf(ctx, 1)).toMatchObject({
        status: 'retired',
        retention: [{ percent: 0, viewers: 7 }],
        timeline: { chapters: CHAPTERS },
        purgeAfter: new Date(NOW.getTime() + EDIT_BASE_RETENTION_MS),
      });
      expect(await curveOf(ctx)).toEqual([]);
      expect(expectOk(await ctx.generations.findEdit(VIDEO))).toMatchObject({
        status: 'applied',
        baseGeneration: 1,
        generation: 2,
      });
    });

    it('lists what is due and bakes the edit list in once its base is purged', async () => {
      await edit(ctx, 2);
      await render(ctx, 2);
      const later = new Date(NOW.getTime() + EDIT_BASE_RETENTION_MS + 1);

      expect(
        expectOk(await ctx.generations.listDue(later, 10)).map(({ generation }) => generation)
      ).toEqual([1]);
      expect(expectOk(await ctx.generations.markPurged(VIDEO, 1, NOW))).toBe(false);
      expect(expectOk(await ctx.generations.markPurged(VIDEO, 1, later))).toBe(true);
      expect(expectOk(await ctx.generations.markPurged(VIDEO, 1, later))).toBe(false);
      expect(await rowOf(ctx, 1)).toMatchObject({ status: 'purged' });
      expect(expectOk(await ctx.generations.findEdit(VIDEO))).toMatchObject({
        baseGeneration: 2,
        trim: null,
        blurs: [],
      });
    });
  });

  describeVideoGenerationRevertContract(makeSubject);
}
