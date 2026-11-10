import { expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const FRAME = 0x0123_4567_89ab_cdefn;
const FLIPPED_BAND_3 = FRAME ^ (0xffffn << 48n);
const UNRELATED = 0xfedc_ba98_7654_3210n;
const HIGH_BIT = 1n << 63n;
const LIMITS = { minBandSetBits: 2, minTermSetBits: 4, maxHitsPerKey: 3 };
const BLACK_FRAME = 0n;
const SILENCE = 0;
const TERM = 0x1234_5678;
const OTHER_TERM = 0x2bcd_ef01;

export function describeFingerprintRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('FingerprintRepository contract', () => {
    let subject: RepositoriesSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      for (const id of [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]) {
        await subject.seedVideo({ ...publicVideo({ id }), ownerId: OWNER_ID });
      }
    });

    const fingerprints = () => subject.repositories.fingerprints;

    describe('frames', () => {
      it('finds a stored frame that shares a band, and not one that shares none', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [
          { idx: 0, hash: FRAME },
          { idx: 1, hash: UNRELATED },
          { idx: 2, hash: FLIPPED_BAND_3 },
        ]);

        const hits = expectOk(
          await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b, LIMITS)
        );

        expect(hits.map((hit) => hit.idx).sort()).toEqual([0, 2]);
        expect(hits.every((hit) => hit.videoId === VIDEO_IDS.a)).toBe(true);
      });

      it('hands a hash back as the 64-bit value it was stored as', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: HIGH_BIT | 5n }]);

        const hits = expectOk(
          await fingerprints().findFramesSharingBand([HIGH_BIT | 5n], VIDEO_IDS.b, LIMITS)
        );

        expect(hits).toEqual([{ videoId: VIDEO_IDS.a, idx: 0, hash: HIGH_BIT | 5n }]);
      });

      it('never returns the querying video, and asks nothing of an empty query', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: FRAME }]);

        expect(
          expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.a, LIMITS))
        ).toEqual([]);
        expect(
          expectOk(await fingerprints().findFramesSharingBand([], VIDEO_IDS.b, LIMITS))
        ).toEqual([]);
      });

      it('answers for every candidate video in one call', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 3, hash: FRAME }]);
        await fingerprints().storeFrames(VIDEO_IDS.b, [{ idx: 7, hash: FRAME }]);

        const hits = expectOk(
          await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.c, LIMITS)
        );

        expect(hits.map((hit) => [hit.videoId, hit.idx]).sort()).toEqual([
          [VIDEO_IDS.a, 3],
          [VIDEO_IDS.b, 7],
        ]);
      });

      it('replaces the frames of a video on a second store', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: FRAME }]);
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: UNRELATED }]);

        expect(
          expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b, LIMITS))
        ).toEqual([]);
      });
    });

    describe('bounded lookups', () => {
      const BLACK_BAND_FRAME = FRAME & (0xffffn << 16n);

      it.each([
        { name: 'a black frame', query: BLACK_FRAME, stored: BLACK_FRAME },
        { name: 'an all-ones frame', query: ~0n, stored: ~0n },
      ])('never matches $name on its flat bands', async ({ query, stored }) => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: stored }]);

        expect(
          expectOk(await fingerprints().findFramesSharingBand([query], VIDEO_IDS.b, LIMITS))
        ).toEqual([]);
      });

      it('still matches on the bands of a frame that has only some flat ones', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: BLACK_BAND_FRAME }]);

        const hits = expectOk(
          await fingerprints().findFramesSharingBand([BLACK_BAND_FRAME], VIDEO_IDS.b, LIMITS)
        );

        expect(hits.map((hit) => hit.idx)).toEqual([0]);
      });

      it('holds a query of many frames sharing one band to the cap per band', async () => {
        const crowd = Array.from({ length: 10 }, (_, idx) => ({ idx, hash: FRAME }));
        await fingerprints().storeFrames(VIDEO_IDS.a, crowd);
        await fingerprints().storeFrames(VIDEO_IDS.c, crowd);

        const hits = expectOk(
          await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b, LIMITS)
        );

        expect(hits).toHaveLength(4 * LIMITS.maxHitsPerKey);
      });

      it('never matches silence, and holds a common term to the cap', async () => {
        const crowd = Array.from({ length: 10 }, (_, idx) => ({ idx, term: TERM }));
        await fingerprints().storeAudio(VIDEO_IDS.a, [
          ...crowd,
          { idx: 20, term: SILENCE },
          { idx: 21, term: -1 },
        ]);

        const hits = expectOk(
          await fingerprints().findAudioTerms([SILENCE, -1, TERM], VIDEO_IDS.b, LIMITS)
        );

        expect(hits).toHaveLength(LIMITS.maxHitsPerKey);
        expect(hits.every((hit) => hit.term === TERM)).toBe(true);
      });
    });

    describe('audio', () => {
      it('finds the stored terms equal to a queried one, with their positions', async () => {
        await fingerprints().storeAudio(VIDEO_IDS.a, [
          { idx: 0, term: TERM },
          { idx: 8, term: 7 },
          { idx: 16, term: OTHER_TERM },
        ]);

        const hits = expectOk(
          await fingerprints().findAudioTerms([TERM, OTHER_TERM], VIDEO_IDS.b, LIMITS)
        );

        expect(
          hits.map((hit) => [hit.idx, hit.term]).sort(([a], [b]) => (a ?? 0) - (b ?? 0))
        ).toEqual([
          [0, TERM],
          [16, OTHER_TERM],
        ]);
      });

      it('never returns the querying video, and asks nothing of an empty query', async () => {
        await fingerprints().storeAudio(VIDEO_IDS.a, [{ idx: 0, term: TERM }]);

        expect(expectOk(await fingerprints().findAudioTerms([TERM], VIDEO_IDS.a, LIMITS))).toEqual(
          []
        );
        expect(expectOk(await fingerprints().findAudioTerms([], VIDEO_IDS.b, LIMITS))).toEqual([]);
      });

      it('reads back a video in position order and replaces it on a second store', async () => {
        await fingerprints().storeAudio(VIDEO_IDS.a, [
          { idx: 8, term: 2 },
          { idx: 0, term: 1 },
        ]);

        expect(expectOk(await fingerprints().audioTermsOf(VIDEO_IDS.a))).toEqual([
          { idx: 0, term: 1 },
          { idx: 8, term: 2 },
        ]);

        await fingerprints().storeAudio(VIDEO_IDS.a, [{ idx: 0, term: 9 }]);

        expect(expectOk(await fingerprints().audioTermsOf(VIDEO_IDS.a))).toEqual([
          { idx: 0, term: 9 },
        ]);
        expect(expectOk(await fingerprints().audioTermsOf(VIDEO_IDS.b))).toEqual([]);
      });
    });

    it('forgets everything on clear and reset', async () => {
      await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: FRAME }]);
      await fingerprints().storeAudio(VIDEO_IDS.a, [{ idx: 0, term: TERM }]);
      await subject.reset();

      expect(
        expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b, LIMITS))
      ).toEqual([]);
      expect(expectOk(await fingerprints().findAudioTerms([TERM], VIDEO_IDS.b, LIMITS))).toEqual(
        []
      );
    });

    it('removes the frames and audio of a deleted video and leaves the others', async () => {
      await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: FRAME }]);
      await fingerprints().storeAudio(VIDEO_IDS.a, [{ idx: 0, term: 7 }]);
      await fingerprints().storeFrames(VIDEO_IDS.c, [{ idx: 0, hash: FRAME }]);

      expectOk(await fingerprints().deleteForVideo(VIDEO_IDS.a));

      expect(expectOk(await fingerprints().audioTermsOf(VIDEO_IDS.a))).toEqual([]);
      const hits = expectOk(
        await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b, LIMITS)
      );
      expect(hits.map((hit) => hit.videoId)).toEqual([VIDEO_IDS.c]);
    });
  });
}
