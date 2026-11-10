import { expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, VIDEO_IDS } from './fixtures';
import { finding, MODERATOR_A, screening } from './screening-fixtures';
import type { RepositoriesSubject } from './subjects';

const FLAG_ID = '00000000-0000-7000-8000-0000000005d1';
const SECOND_ID = '00000000-0000-7000-8000-0000000005a2';
const LATER = new Date('2999-01-01T00:00:00Z');

export function describeScreeningCases(subject: () => RepositoriesSubject): void {
  const screenings = () => subject().repositories.screenings;
  const spam = (score: number) => ({
    reason: 'METADATA_SPAM' as const,
    score,
    evidence: { signals: ['links'] },
  });
  const raise = (flag = spam(0.5)) =>
    screenings().raiseFlag({
      id: FLAG_ID,
      videoId: VIDEO_IDS.a,
      finding: flag,
      thresholdVersion: 'v1',
    });
  const seed = async () => {
    await subject().seedVideo(publicVideo({ id: VIDEO_IDS.a }));
    await subject().seedVideo(publicVideo({ id: VIDEO_IDS.b }));
  };
  const open = async () =>
    expectOk(await screenings().listCases({ cursor: null, limit: 10, state: 'open' })).map(
      ({ screening: row }) => row.id
    );

  describe('review cases', () => {
    it('starts a passed result for a flag on a video that was never screened, once', async () => {
      await seed();

      expect(expectOk(await raise())).toBe(true);
      expect(expectOk(await raise())).toBe(false);

      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toMatchObject({
        id: FLAG_ID,
        outcome: 'PASS',
        reasons: [],
        flags: [spam(0.5)],
      });
      expect(await open()).toEqual([FLAG_ID]);
    });

    it('replaces the flag of a reason with a changed finding and keeps the other flags', async () => {
      await seed();
      await screenings().record(
        screening({ outcome: 'PASS', reasons: [], flags: [finding('PARTIAL_MATCH', 0.4)] })
      );

      expect(expectOk(await raise(spam(0.3)))).toBe(true);
      expect(expectOk(await raise(spam(0.6)))).toBe(true);

      const latest = expectOk(await screenings().latestForVideo(VIDEO_IDS.a));
      expect(latest?.flags.map(({ reason, score }) => [reason, score])).toEqual([
        ['PARTIAL_MATCH', 0.4],
        ['METADATA_SPAM', 0.6],
      ]);
    });

    it('closes a dismissed flag for good, and reopens it when the finding changes', async () => {
      await seed();
      await raise();
      await screenings().dismiss({ videoId: VIDEO_IDS.a, moderatorId: MODERATOR_A });

      expect(await open()).toEqual([]);
      expect(expectOk(await raise())).toBe(false);
      expect(await open()).toEqual([]);

      expect(expectOk(await raise(spam(0.9)))).toBe(true);
      expect(await open()).toEqual([FLAG_ID]);
      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toMatchObject({
        decision: null,
        decidedBy: null,
      });
    });

    it('opens a flag raised after the hold was approved, and leaves the decision alone', async () => {
      await seed();
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.c, status: 'HELD' }));
      await screenings().record(screening({ videoId: VIDEO_IDS.c }));
      await screenings().approve({ videoId: VIDEO_IDS.c, moderatorId: MODERATOR_A });
      const raiseOnC = () =>
        screenings().raiseFlag({
          id: FLAG_ID,
          videoId: VIDEO_IDS.c,
          finding: spam(0.5),
          thresholdVersion: 'v1',
        });

      expect(expectOk(await raiseOnC())).toBe(true);
      expect(await open()).toEqual(['00000000-0000-7000-8000-0000000005a1']);

      expect(
        expectOk(await screenings().dismiss({ videoId: VIDEO_IDS.c, moderatorId: MODERATOR_A }))
      ).toBe(true);
      expect(await open()).toEqual([]);
      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.c))).toMatchObject({
        decision: 'approved',
      });
    });

    it('lists holds and flagged results, open before decided, newest first, a page at a time', async () => {
      await seed();
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.c }));
      await screenings().record(screening());
      await screenings().record(
        screening({
          id: SECOND_ID,
          videoId: VIDEO_IDS.b,
          outcome: 'PASS',
          reasons: [],
          flags: [finding('PARTIAL_MATCH', 0.4)],
        })
      );
      await screenings().record(
        screening({
          id: FLAG_ID,
          videoId: VIDEO_IDS.c,
          outcome: 'PASS',
          reasons: [],
          flags: [],
        })
      );
      await screenings().dismiss({ videoId: VIDEO_IDS.b, moderatorId: MODERATOR_A });

      const all = expectOk(await screenings().listCases({ cursor: null, limit: 10 }));
      const [first, second] = expectOk(await screenings().listCases({ cursor: null, limit: 1 }));
      const decided = expectOk(
        await screenings().listCases({ cursor: null, limit: 10, state: 'decided' })
      );

      expect(all.map(({ screening: row }) => row.id)).toEqual([
        '00000000-0000-7000-8000-0000000005a1',
        SECOND_ID,
      ]);
      expect(first?.screening.id).toBe('00000000-0000-7000-8000-0000000005a1');
      expect(second?.screening.id).toBe(SECOND_ID);
      expect(decided.map(({ screening: row }) => row.id)).toEqual([SECOND_ID]);
    });

    it('resumes after a cursor', async () => {
      await seed();
      await screenings().record(screening());
      await screenings().record(
        screening({ id: SECOND_ID, videoId: VIDEO_IDS.b, sourceChecksum: 'sum-2' })
      );
      const [newest, older] = expectOk(await screenings().listCases({ cursor: null, limit: 10 }));
      if (!(newest && older)) throw new Error('two cases expected');

      const rest = expectOk(
        await screenings().listCases({
          cursor: { open: true, createdAt: newest.screening.createdAt, id: newest.screening.id },
          limit: 10,
        })
      );

      expect(rest.map(({ screening: row }) => row.id)).toEqual([older.screening.id]);
    });

    it('hands each case the newest appeal of its video', async () => {
      await seed();
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.c, status: 'HELD' }));
      await screenings().record(screening({ videoId: VIDEO_IDS.c }));
      await screenings().reject({ videoId: VIDEO_IDS.c, moderatorId: MODERATOR_A, reason: 'no' });
      await screenings().appeal({
        id: '00000000-0000-7000-8000-0000000005b1',
        videoId: VIDEO_IDS.c,
        authorId: OWNER_ID,
        message: 'mine',
      });

      const [found] = expectOk(await screenings().listCases({ cursor: null, limit: 10 }));

      expect(found?.appeal).toMatchObject({ message: 'mine', rejectedBy: MODERATOR_A });
    });

    it('offers only decided cases past the retention for evidence removal, once', async () => {
      await seed();
      await screenings().record(screening());
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.c, status: 'HELD' }));
      await screenings().record(screening({ id: SECOND_ID, videoId: VIDEO_IDS.c }));
      await screenings().reject({ videoId: VIDEO_IDS.c, moderatorId: MODERATOR_A, reason: 'no' });
      const purgeable = async (closedBefore: Date) =>
        expectOk(await screenings().findPurgeableEvidence({ closedBefore, limit: 10 })).map(
          (row) => row.id
        );

      expect(await purgeable(new Date('2000-01-01T00:00:00Z'))).toEqual([]);
      expect(await purgeable(LATER)).toEqual([SECOND_ID]);

      expect(expectOk(await screenings().markEvidencePurged(SECOND_ID))).toBe(true);
      expect(expectOk(await screenings().markEvidencePurged(SECOND_ID))).toBe(false);
      expect(await purgeable(LATER)).toEqual([]);
    });
  });
}
