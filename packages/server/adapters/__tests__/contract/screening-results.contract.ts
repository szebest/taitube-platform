import type { ScreeningRecord } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { publicVideo, VIDEO_IDS } from './fixtures';
import { finding, MODERATOR_A, screening } from './screening-fixtures';
import type { RepositoriesSubject } from './subjects';

export function describeScreeningResults(subject: () => RepositoriesSubject): void {
  const screenings = () => subject().repositories.screenings;
  const eventTypes = async () =>
    expectOk(await subject().repositories.events.findByVideoId(VIDEO_IDS.a)).map(
      (event) => event.type
    );

  describe('stored results', () => {
    it('stores one result per video and source and hands the first back on a repeat', async () => {
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      const first = expectOk(await screenings().record(screening({ outcome: 'HOLD' })));
      const again = expectOk(
        await screenings().record(
          screening({ id: '00000000-0000-7000-8000-0000000005a2', outcome: 'PASS', score: 0 })
        )
      );

      expect(again).toEqual(first);
      expect(expectOk(await screenings().findByVideo(VIDEO_IDS.a, 'sum-1'))).toEqual(first);
      expect(expectOk(await screenings().findByVideo(VIDEO_IDS.a, 'other'))).toBeNull();
    });

    it('reads the newest result of a video whatever its source', async () => {
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await screenings().record(screening());
      const newer: ScreeningRecord = expectOk(
        await screenings().record(
          screening({
            id: '00000000-0000-7000-8000-0000000005a2',
            sourceChecksum: 'sum-2',
            outcome: 'PASS',
            score: 0,
            reasons: [],
          })
        )
      );

      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toEqual(newer);
      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.b))).toBeNull();
    });

    it.each([
      {
        name: 'a passed result with a flag',
        outcome: 'PASS' as const,
        flags: [finding('PARTIAL_MATCH', 0.4)],
        dismissed: true,
      },
      {
        name: 'a passed result with no flag',
        outcome: 'PASS' as const,
        flags: [],
        dismissed: false,
      },
      {
        name: 'a held result',
        outcome: 'HOLD' as const,
        flags: [finding('PARTIAL_MATCH', 0.4)],
        dismissed: false,
      },
    ])('dismisses $name: $dismissed, once', async ({ outcome, flags, dismissed }) => {
      await subject().seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await screenings().record(screening({ outcome, flags, reasons: [] }));
      const dismiss = () =>
        screenings().dismiss({ videoId: VIDEO_IDS.a, moderatorId: MODERATOR_A });

      expect(expectOk(await dismiss())).toBe(dismissed);
      expect(expectOk(await dismiss())).toBe(false);
      expect(await eventTypes()).toEqual(dismissed ? ['video.screening_dismissed'] : []);
    });
  });
}
