import type { VideoChapterRepository, VideoStudioRepository } from '@vp/core/repositories';
import type { Chapter, VideoMetadataSnapshot } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHAPTERS: Chapter[] = [
  { startMs: 0, title: 'Intro' },
  { startMs: 30_000, title: 'Middle' },
  { startMs: 90_000, title: 'End' },
];

export function describeVideoChapterRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoChapterRepository contract', () => {
    let subject: RepositoriesSubject;
    let chapters: VideoChapterRepository;
    let studio: VideoStudioRepository;

    const versionOf = async (videoId: string) =>
      expectOk(await subject.repositories.videos.findById(videoId))?.version ?? -1;

    const edit = async (
      patch: Parameters<VideoStudioRepository['updateMetadata']>[0]['patch'],
      expectedVersion?: number,
      videoId: string = VIDEO_IDS.a
    ) =>
      studio.updateMetadata({
        videoId,
        expectedVersion: expectedVersion ?? (await versionOf(videoId)),
        patch,
        userId: OWNER_ID,
        auditFields: [],
      });

    const listOf = async (videoId: string = VIDEO_IDS.a) =>
      expectOk(await chapters.listFor([videoId])).get(videoId);

    const history = async (videoId: string = VIDEO_IDS.a) =>
      expectOk(
        await subject.repositories.entityRevisions.list('video_metadata', videoId, {
          beforeVersion: null,
          limit: 10,
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
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, title: 'Before' }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      chapters = subject.repositories.videoChapters;
      studio = subject.repositories.videoStudio;
    });

    it('gives every id an entry, empty without chapters', async () => {
      const found = expectOk(await chapters.listFor([VIDEO_IDS.a, VIDEO_IDS.b]));

      expect([...found.entries()]).toEqual([
        [VIDEO_IDS.a, []],
        [VIDEO_IDS.b, []],
      ]);
      expect(expectOk(await chapters.listFor([])).size).toBe(0);
    });

    it('replaces the set with an edit, in the order given, and clears it with an empty one', async () => {
      expectOk(await edit({ chapters: [...CHAPTERS].reverse() }));
      expect(await listOf()).toEqual([...CHAPTERS].reverse());

      expectOk(await edit({ chapters: CHAPTERS.slice(0, 1) }));
      expect(await listOf()).toEqual(CHAPTERS.slice(0, 1));

      expectOk(await edit({ chapters: [] }));
      expect(await listOf()).toEqual([]);
    });

    it('keeps the chapters when an edit does not mention them', async () => {
      expectOk(await edit({ chapters: CHAPTERS }));
      expectOk(await edit({ title: 'After' }));

      expect(await listOf()).toEqual(CHAPTERS);
    });

    it('records the state before the first edit and after each edit at its new version', async () => {
      const first = await versionOf(VIDEO_IDS.a);
      expectOk(await edit({ title: 'One', chapters: CHAPTERS }));
      expectOk(await edit({ title: 'Two' }));

      const found = await history();
      const titles = found.map((row) => [row.version, row.snapshot.title]);
      expect(titles).toEqual([
        [first + 2, 'Two'],
        [first + 1, 'One'],
        [first, 'Before'],
      ]);
      const chaptersOf = (version: number): VideoMetadataSnapshot['chapters'] | undefined =>
        found.find((row) => row.version === version)?.snapshot.chapters;
      expect(chaptersOf(first)).toEqual([]);
      expect(chaptersOf(first + 1)).toEqual(CHAPTERS);
      expect(chaptersOf(first + 2)).toEqual(CHAPTERS);
      expect(found[0]?.authorUserId).toBe(OWNER_ID);
      expect(found.at(-1)?.authorUserId).toBeNull();
    });

    it('stores the version a restore went back to on its revision', async () => {
      expectOk(
        await studio.updateMetadata({
          videoId: VIDEO_IDS.a,
          expectedVersion: await versionOf(VIDEO_IDS.a),
          patch: { title: 'Back' },
          userId: OWNER_ID,
          auditFields: ['title'],
          revision: { restoredFromVersion: 3 },
        })
      );

      expect((await history())[0]?.restoredFromVersion).toBe(3);
    });

    it('records nothing and changes no chapter when the write loses its compare-and-set', async () => {
      const version = await versionOf(VIDEO_IDS.a);

      const failure = expectErr(await edit({ title: 'Late', chapters: CHAPTERS }, version + 5));

      expect(failure.code).toBe(ErrorCodes.VERSION_CONFLICT);
      expect(await history()).toEqual([]);
      expect(await listOf()).toEqual([]);
      expect(await versionOf(VIDEO_IDS.a)).toBe(version);
    });
  });
}
