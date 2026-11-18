import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ENTITY_REVISION_KEEP, type VideoMetadataSnapshot } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { runPruneRevisions } from '../prune-revisions';

const VIDEO_ID = '00000000-0000-7000-8000-00000000a001';

const snapshot: VideoMetadataSnapshot = {
  title: 'T',
  description: null,
  tags: [],
  categoryId: null,
  visibility: 'public',
  thumbnail: { source: 'poster' },
  chapters: [],
  commentsEnabled: true,
};

describe('housekeeping: prune-revisions', () => {
  it('drops everything past the newest fifty and counts it', async () => {
    const repositories = new InMemoryRepositories();
    for (let version = 1; version <= ENTITY_REVISION_KEEP + 2; version++) {
      expectOk(
        await repositories.entityRevisions.append({
          entityType: 'video_metadata',
          entityId: VIDEO_ID,
          version,
          snapshot,
          authorUserId: null,
          restoredFromVersion: null,
        })
      );
    }

    const result = expectOk(await runPruneRevisions({ repositories }));

    const kept = expectOk(
      await repositories.entityRevisions.list('video_metadata', VIDEO_ID, {
        beforeVersion: null,
        limit: 100,
      })
    );
    expect(result).toEqual({ purgedCount: 2 });
    expect(kept).toHaveLength(ENTITY_REVISION_KEEP);
  });

  it('prunes nothing when no entity is past the keep', async () => {
    expect(expectOk(await runPruneRevisions({ repositories: new InMemoryRepositories() }))).toEqual(
      {
        purgedCount: 0,
      }
    );
  });
});
