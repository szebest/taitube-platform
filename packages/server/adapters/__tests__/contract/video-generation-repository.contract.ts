import { expectOk } from '@kit/testing/result';
import type { NewOutboxInput, VideoGenerationRepository } from '@vp/core/repositories';
import {
  EDIT_BASE_RETENTION_MS,
  type GenerationPlayback,
  RETIRED_GENERATION_GRACE_MS,
} from '@vp/domain';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { viewBatch } from './view-batch';

const VIDEO = VIDEO_IDS.a;
const TOKEN = '00000000-0000-7000-8000-0000000000e1';
const STALE = '00000000-0000-7000-8000-0000000000e2';
const NOW = new Date('2026-03-01T12:00:00.000Z');
const CHAPTERS = [0, 60_000, 120_000, 180_000].map((startMs) => ({
  startMs,
  title: `at ${startMs}`,
}));

const outboxRow = (generation: number): NewOutboxInput => ({
  kind: 'apply-edits',
  payload: {
    type: 'queue',
    queueName: 'transcode-1080p',
    job: { name: 'apply-edits', data: { generation } },
  },
});

const playback = (generation: number, durationMs = 240_000): GenerationPlayback => ({
  masterPlaylistKey: `videos/${VIDEO}/hls/g${generation}/master.m3u8`,
  durationMs,
  width: 1280,
  height: 720,
  fps: 30,
  ladder: [{ name: '720p' }],
});

export function describeVideoGenerationRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoGenerationRepository contract', () => {
    let subject: RepositoriesSubject;
    let generations: VideoGenerationRepository;

    const video = async () => {
      const found = expectOk(await subject.repositories.videos.findById(VIDEO));
      if (!found) throw new Error('seeded video is gone');
      return { ...found };
    };
    const rowOf = async (generation: number) =>
      expectOk(await generations.list(VIDEO)).find((row) => row.generation === generation);
    const replacedEvents = async () =>
      expectOk(await subject.repositories.events.findByVideoId(VIDEO)).filter(
        ({ type }) => type === 'video.replaced'
      );
    const announced = async () =>
      expectOk(await subject.repositories.userEvents.listFrom(OWNER_ID, 0, 100))
        .filter(({ type }) => type === 'video.generation.updated')
        .map(({ payload }) => payload);
    const chaptersOf = async () =>
      expectOk(await subject.repositories.videoChapters.listFor([VIDEO])).get(VIDEO);
    const curveOf = async () =>
      expectOk(await subject.repositories.videoViews.retentionCurve(VIDEO));
    const seedRetention = async () =>
      expectOk(
        await subject.repositories.videoViews.applyBatch(
          viewBatch({ retention: [{ videoId: VIDEO, percent: 0, viewers: 7 }] })
        )
      );
    const render = async (generation: number, durationMs?: number) => {
      expectOk(await generations.claim(VIDEO, generation, TOKEN));
      return expectOk(
        await generations.swap({
          videoId: VIDEO,
          generation,
          claim: { type: 'render', lockToken: TOKEN, playback: playback(generation, durationMs) },
          now: NOW,
        })
      );
    };
    const replace = async (generation: number) => {
      expectOk(
        await generations.openReplacement({
          videoId: VIDEO,
          generation,
          replacesGeneration: (await video()).generation,
          sourceKey: `raw/${VIDEO}/g${generation}/source.mp4`,
          uploadExpiresAt: new Date(NOW.getTime() + 3_600_000),
        })
      );
      expectOk(await generations.startRender(VIDEO, generation, outboxRow(generation)));
    };
    const edit = async (generation: number, baseGeneration = 1) =>
      expectOk(
        await generations.saveEdit({
          videoId: VIDEO,
          generation,
          baseGeneration,
          replacesGeneration: (await video()).generation,
          edit: { trim: { startMs: 30_000, endMs: 240_000 }, blurs: [] },
          outbox: outboxRow(generation),
        })
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.seedVideo(
        publicVideo({
          id: VIDEO,
          durationMs: 240_000,
          masterPlaylistKey: `videos/${VIDEO}/hls/master.m3u8`,
          ladder: [{ name: '720p' }],
        })
      );
      expectOk(
        await subject.repositories.videoStudio.updateMetadata({
          videoId: VIDEO,
          expectedVersion: (await video()).version,
          patch: { chapters: CHAPTERS },
          userId: OWNER_ID,
          auditFields: [],
        })
      );
      generations = subject.repositories.videoGenerations;
    });

    it('holds one replacement in flight per video and moves it to rendering once', async () => {
      await replace(2);

      expect(
        expectOk(
          await generations.openReplacement({
            videoId: VIDEO,
            generation: 3,
            replacesGeneration: 1,
            sourceKey: 'raw/x',
            uploadExpiresAt: NOW,
          })
        )
      ).toBe(false);
      expect(expectOk(await generations.startRender(VIDEO, 2, outboxRow(2)))).toBe(false);
      expect(await rowOf(2)).toMatchObject({ kind: 'replacement', status: 'rendering' });
    });

    it('swaps a rendered replacement in once, keeping the old one for players that hold it', async () => {
      await replace(2);
      const before = await video();

      expect(await render(2, 300_000)).toEqual({ type: 'swapped', version: before.version + 1 });
      expect(await video()).toMatchObject({
        generation: 2,
        version: before.version + 1,
        masterPlaylistKey: playback(2).masterPlaylistKey,
        durationMs: 300_000,
        viewsCount: before.viewsCount,
      });
      expect(await rowOf(2)).toMatchObject({ status: 'active', needsReview: true });
      expect(await rowOf(1)).toMatchObject({
        status: 'retired',
        playback: { masterPlaylistKey: before.masterPlaylistKey, durationMs: 240_000 },
        purgeAfter: new Date(NOW.getTime() + RETIRED_GENERATION_GRACE_MS),
      });
      expect(await render(2)).toEqual({ type: 'fenced' });
      expect(await replacedEvents()).toHaveLength(1);
      expect(await announced()).toEqual([{ videoId: VIDEO, generation: 2, status: 'active' }]);
    });

    it('fences a render whose claim was taken over, and supersedes one the video moved past', async () => {
      await replace(2);
      expectOk(await generations.claim(VIDEO, 2, STALE));
      expectOk(await generations.claim(VIDEO, 2, TOKEN));
      const stale = await generations.swap({
        videoId: VIDEO,
        generation: 2,
        claim: { type: 'render', lockToken: STALE, playback: playback(2) },
        now: NOW,
      });
      expect(expectOk(stale)).toEqual({ type: 'fenced' });

      expectOk(await subject.repositories.videos.transition({ videoId: VIDEO, edge: 'reprocess' }));
      expect(await render(2)).toEqual({ type: 'superseded' });
      expect(await video()).toMatchObject({ generation: 1 });
      expect(await replacedEvents()).toHaveLength(0);
    });

    it('fails an in-flight generation and leaves the video alone', async () => {
      await replace(2);
      const before = await video();

      expect(expectOk(await generations.fail(VIDEO, 2, 'CORRUPT_CONTAINER'))).toBe(true);
      expect(expectOk(await generations.fail(VIDEO, 2, 'CORRUPT_CONTAINER'))).toBe(false);
      expect(await rowOf(2)).toMatchObject({ status: 'failed', errorCode: 'CORRUPT_CONTAINER' });
      expect(await video()).toEqual(before);
      expect(await announced()).toEqual([{ videoId: VIDEO, generation: 2, status: 'failed' }]);
    });

    it('renders an edit onto the shifted timeline, keeping its base to revert to', async () => {
      await seedRetention();
      await edit(2);

      expect(await render(2, 210_000)).toMatchObject({ type: 'swapped' });
      const starts = (await chaptersOf())?.map(({ startMs }) => startMs);
      expect(starts).toEqual([0, 30_000, 90_000, 150_000]);
      expect(await rowOf(1)).toMatchObject({
        status: 'retired',
        retention: [{ percent: 0, viewers: 7 }],
        timeline: { chapters: CHAPTERS },
        purgeAfter: new Date(NOW.getTime() + EDIT_BASE_RETENTION_MS),
      });
      expect(await curveOf()).toEqual([]);
      expect(expectOk(await generations.findEdit(VIDEO))).toMatchObject({
        status: 'applied',
        baseGeneration: 1,
        generation: 2,
      });
    });

    it('reverts to the base under the current version only, restoring its timeline and curve', async () => {
      await seedRetention();
      await edit(2);
      await render(2, 210_000);
      const edited = await video();
      const revert = (expectedVersion: number) =>
        generations.swap({
          videoId: VIDEO,
          generation: 1,
          claim: { type: 'revert', expectedVersion },
          now: NOW,
        });

      expect(expectOk(await revert(edited.version - 1))).toEqual({ type: 'superseded' });
      expect(expectOk(await revert(edited.version))).toMatchObject({ type: 'swapped' });
      expect(await video()).toMatchObject({ generation: 1, durationMs: 240_000 });
      expect(await chaptersOf()).toEqual(CHAPTERS);
      expect(await curveOf()).toEqual([{ percent: 0, viewers: 7 }]);
      expect(await rowOf(2)).toMatchObject({ status: 'retired' });
      expect(expectOk(await generations.findEdit(VIDEO))).toMatchObject({ status: 'reverted' });
    });

    it('lists what is due and bakes the edit list in once its base is purged', async () => {
      await edit(2);
      await render(2);
      const later = new Date(NOW.getTime() + EDIT_BASE_RETENTION_MS + 1);

      expect(
        expectOk(await generations.listDue(later, 10)).map(({ generation }) => generation)
      ).toEqual([1]);
      expect(expectOk(await generations.markPurged(VIDEO, 1))).toBe(true);
      expect(expectOk(await generations.markPurged(VIDEO, 1))).toBe(false);
      expect(await rowOf(1)).toMatchObject({ status: 'purged' });
      expect(expectOk(await generations.findEdit(VIDEO))).toMatchObject({
        baseGeneration: 2,
        trim: null,
        blurs: [],
      });
    });
  });
}
