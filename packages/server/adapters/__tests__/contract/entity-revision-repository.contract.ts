import type { EntityRevisionRepository, NewEntityRevision } from '@vp/core/repositories';
import { ENTITY_REVISION_KEEP, type VideoMetadataSnapshot } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const snapshot = (title: string): VideoMetadataSnapshot => ({
  title,
  description: null,
  tags: [],
  categoryId: null,
  visibility: 'public',
  thumbnail: { source: 'poster' },
  chapters: [],
  commentsEnabled: true,
});

function revision(version: number, videoId: string = VIDEO_IDS.a): NewEntityRevision {
  return {
    entityType: 'video_metadata',
    entityId: videoId,
    version,
    snapshot: snapshot(`v${version}`),
    authorUserId: OWNER_ID,
    restoredFromVersion: null,
  };
}

export function describeEntityRevisionRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('EntityRevisionRepository contract', () => {
    let subject: RepositoriesSubject;
    let revisions: EntityRevisionRepository;

    const append = async (...rows: NewEntityRevision[]) => {
      for (const row of rows) expectOk(await revisions.append(row));
    };
    const list = async (
      beforeVersion: number | null = null,
      limit = 10,
      videoId: string = VIDEO_IDS.a
    ) => expectOk(await revisions.list('video_metadata', videoId, { beforeVersion, limit }));

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
      revisions = subject.repositories.entityRevisions;
    });

    it('lists the newest version first and reads each back whole', async () => {
      await append(revision(2), revision(5), revision(3));

      const found = await list();

      expect(found.map((row) => row.version)).toEqual([5, 3, 2]);
      expect(found[0]).toMatchObject({
        entityType: 'video_metadata',
        entityId: VIDEO_IDS.a,
        snapshot: snapshot('v5'),
        authorUserId: OWNER_ID,
        restoredFromVersion: null,
      });
      expect(found[0]?.createdAt).toBeInstanceOf(Date);
    });

    it('walks a keyset and returns one row over the limit to show there is more', async () => {
      await append(revision(1), revision(2), revision(3), revision(4));

      const first = await list(null, 2);
      const second = await list(first[1]?.version ?? 0, 2);

      expect(first.map((row) => row.version)).toEqual([4, 3, 2]);
      expect(second.map((row) => row.version)).toEqual([2, 1]);
    });

    it('keeps the entities apart', async () => {
      await append(revision(2), revision(7, VIDEO_IDS.b));

      expect((await list()).map((row) => row.version)).toEqual([2]);
      expect((await list(null, 10, VIDEO_IDS.b)).map((row) => row.version)).toEqual([7]);
    });

    it('leaves a version already recorded as it was', async () => {
      await append(revision(2));
      await append({ ...revision(2), snapshot: snapshot('second try') });

      expect((await list()).map((row) => row.snapshot.title)).toEqual(['v2']);
    });

    it('gets a revision by id only inside its own entity', async () => {
      await append(revision(2));
      const [stored] = await list();

      expect(
        expectOk(await revisions.get('video_metadata', VIDEO_IDS.a, stored?.id ?? ''))
      ).toMatchObject({
        version: 2,
      });
      expect(
        expectOk(await revisions.get('video_metadata', VIDEO_IDS.b, stored?.id ?? ''))
      ).toBeNull();
    });

    it('prunes all but the newest revisions of every entity', async () => {
      const total = ENTITY_REVISION_KEEP + 3;
      await append(
        ...Array.from({ length: total }, (_, index) => revision(index + 1)),
        revision(1, VIDEO_IDS.b)
      );

      const dropped = expectOk(await revisions.prune(ENTITY_REVISION_KEEP));

      const kept = await list(null, total);
      expect(dropped).toBe(3);
      expect(kept).toHaveLength(ENTITY_REVISION_KEEP);
      expect(kept.at(-1)?.version).toBe(4);
      expect(await list(null, 10, VIDEO_IDS.b)).toHaveLength(1);
    });
  });
}
