import type { VideoCorrectionRepository } from '@vp/core/repositories';
import type { Correction } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const correctionId = (n: number) =>
  `00000000-0000-7000-8000-00000000d1${String(n).padStart(2, '0')}`;

function correction(n: number, overrides: Partial<Correction> = {}): Correction {
  return {
    id: correctionId(n),
    videoId: VIDEO_IDS.a,
    startMs: n * 10_000,
    endMs: n * 10_000 + 5_000,
    text: `Correction ${n}`,
    createdAt: new Date(Date.parse('2026-03-01T12:00:00.000Z') + n),
    ...overrides,
  };
}

export function describeVideoCorrectionRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoCorrectionRepository contract', () => {
    let subject: RepositoriesSubject;
    let corrections: VideoCorrectionRepository;

    const create = async (row: Correction, limit = 10) =>
      expectOk(await corrections.create(row, limit));
    const list = async (videoId: string = VIDEO_IDS.a) => expectOk(await corrections.list(videoId));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      corrections = subject.repositories.videoCorrections;
    });

    it('lists a video corrections in playback order, each read back whole', async () => {
      await create(correction(3));
      await create(correction(1));
      await create(correction(2, { videoId: VIDEO_IDS.b }));

      expect(await list()).toEqual([correction(1), correction(3)]);
      expect(await list(VIDEO_IDS.b)).toEqual([correction(2, { videoId: VIDEO_IDS.b })]);
    });

    it('refuses a correction once the video holds the limit, and says so', async () => {
      await create(correction(1), 2);
      await create(correction(2), 2);

      expect(await create(correction(3), 2)).toBe(false);
      expect(await list()).toHaveLength(2);
      expect(await create(correction(4, { videoId: VIDEO_IDS.b }), 2)).toBe(true);
    });

    it('removes a correction only from its own video', async () => {
      await create(correction(1));

      expect(expectOk(await corrections.remove(VIDEO_IDS.b, correctionId(1)))).toBe(false);
      expect(expectOk(await corrections.remove(VIDEO_IDS.a, correctionId(1)))).toBe(true);
      expect(expectOk(await corrections.remove(VIDEO_IDS.a, correctionId(1)))).toBe(false);
      expect(await list()).toEqual([]);
    });
  });
}
