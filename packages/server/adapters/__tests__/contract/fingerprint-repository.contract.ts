import { expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const FRAME = 0x0123_4567_89ab_cdefn;
const FLIPPED_BAND_3 = FRAME ^ (0xffffn << 48n);
const UNRELATED = 0xfedc_ba98_7654_3210n;
const HIGH_BIT = 1n << 63n;

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

        const hits = expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b));

        expect(hits.map((hit) => hit.idx).sort()).toEqual([0, 2]);
        expect(hits.every((hit) => hit.videoId === VIDEO_IDS.a)).toBe(true);
      });

      it('hands a hash back as the 64-bit value it was stored as', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: HIGH_BIT | 5n }]);

        const hits = expectOk(
          await fingerprints().findFramesSharingBand([HIGH_BIT | 5n], VIDEO_IDS.b)
        );

        expect(hits).toEqual([{ videoId: VIDEO_IDS.a, idx: 0, hash: HIGH_BIT | 5n }]);
      });

      it('never returns the querying video, and asks nothing of an empty query', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: FRAME }]);

        expect(expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.a))).toEqual(
          []
        );
        expect(expectOk(await fingerprints().findFramesSharingBand([], VIDEO_IDS.b))).toEqual([]);
      });

      it('answers for every candidate video in one call', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 3, hash: FRAME }]);
        await fingerprints().storeFrames(VIDEO_IDS.b, [{ idx: 7, hash: FRAME }]);

        const hits = expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.c));

        expect(hits.map((hit) => [hit.videoId, hit.idx]).sort()).toEqual([
          [VIDEO_IDS.a, 3],
          [VIDEO_IDS.b, 7],
        ]);
      });

      it('replaces the frames of a video on a second store', async () => {
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: FRAME }]);
        await fingerprints().storeFrames(VIDEO_IDS.a, [{ idx: 0, hash: UNRELATED }]);

        expect(expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b))).toEqual(
          []
        );
      });
    });

    describe('audio', () => {
      it('finds the stored terms equal to a queried one, with their positions', async () => {
        await fingerprints().storeAudio(VIDEO_IDS.a, [
          { idx: 0, term: -5 },
          { idx: 8, term: 7 },
          { idx: 16, term: 2_000_000_000 },
        ]);

        const hits = expectOk(
          await fingerprints().findAudioTerms([-5, 2_000_000_000], VIDEO_IDS.b)
        );

        expect(
          hits.map((hit) => [hit.idx, hit.term]).sort(([a], [b]) => (a ?? 0) - (b ?? 0))
        ).toEqual([
          [0, -5],
          [16, 2_000_000_000],
        ]);
      });

      it('never returns the querying video, and asks nothing of an empty query', async () => {
        await fingerprints().storeAudio(VIDEO_IDS.a, [{ idx: 0, term: 1 }]);

        expect(expectOk(await fingerprints().findAudioTerms([1], VIDEO_IDS.a))).toEqual([]);
        expect(expectOk(await fingerprints().findAudioTerms([], VIDEO_IDS.b))).toEqual([]);
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
      await fingerprints().storeAudio(VIDEO_IDS.a, [{ idx: 0, term: 1 }]);
      await subject.reset();

      expect(expectOk(await fingerprints().findFramesSharingBand([FRAME], VIDEO_IDS.b))).toEqual(
        []
      );
      expect(expectOk(await fingerprints().findAudioTerms([1], VIDEO_IDS.b))).toEqual([]);
    });
  });
}
