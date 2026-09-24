import { expectOk } from '@vp/testing/result';
import { HOUR_MS, VIDEO_IDS, idsOf, publicVideo } from './fixtures';
import type { VideoContractContext } from './video-contract-context';
import { SCAN_CASES, type ScanCase } from './video-scan-cases';

export function describeVideoLifecycleContract(ctx: VideoContractContext): void {
  describe('state transitions', () => {
    beforeEach(async () => {
      expectOk(await ctx.videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
    });

    const completeUpload = () =>
      ctx.videos.transition({
        videoId: VIDEO_IDS.a,
        from: 'UPLOADING',
        to: 'UPLOADED',
        eventType: 'upload.completed',
      });

    it('commits a transition once and refuses the stale repeat', async () => {
      expect(expectOk(await completeUpload())).toBe(true);
      expect(expectOk(await completeUpload())).toBe(false);

      expect(expectOk(await ctx.videos.findById(VIDEO_IDS.a))?.status).toBe('UPLOADED');
    });

    it('appends exactly one event per committed transition', async () => {
      await completeUpload();
      await completeUpload();

      const events = expectOk(await ctx.subject.repositories.events.findByVideoId(VIDEO_IDS.a));
      expect(events.filter((e) => e.type === 'upload.completed')).toHaveLength(1);
    });

    it('accepts any of the allowed source states', async () => {
      expect(
        expectOk(
          await ctx.videos.transition({
            videoId: VIDEO_IDS.a,
            from: ['UPLOADED', 'UPLOADING'],
            to: 'PROBING',
            eventType: 'video.probing',
          })
        )
      ).toBe(true);
    });
  });

  describe('housekeeping scans', () => {
    it.each<ScanCase>(SCAN_CASES)('$scenario', async ({ seed, filter }) => {
      await seed(ctx.subject.repositories);
      expect(idsOf(expectOk(await ctx.videos.scan(filter)))).toEqual([VIDEO_IDS.a]);
    });

    it('leaves rows alone until they have been idle for the whole threshold', async () => {
      expectOk(await ctx.videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
      expect(
        expectOk(
          await ctx.videos.scan({
            status: 'UPLOADING',
            idleFor: { since: 'updatedAt', ms: HOUR_MS },
          })
        )
      ).toEqual([]);
    });

    it('returns no more rows than the limit', async () => {
      expectOk(await ctx.videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })));
      expectOk(await ctx.videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'UPLOADING' })));
      expect(expectOk(await ctx.videos.scan({ status: 'UPLOADING', limit: 1 }))).toHaveLength(1);
    });

    it('hard-deletes only a soft-deleted video', async () => {
      expectOk(await ctx.videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'READY' })));
      expect(expectOk(await ctx.videos.hardDelete(VIDEO_IDS.a))).toBe(false);

      expectOk(
        await ctx.videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'READY',
          to: 'DELETED',
          eventType: 'video.deleted',
        })
      );

      expect(expectOk(await ctx.videos.hardDelete(VIDEO_IDS.a))).toBe(true);
      expect(expectOk(await ctx.videos.findById(VIDEO_IDS.a))).toBeNull();
    });
  });
}
