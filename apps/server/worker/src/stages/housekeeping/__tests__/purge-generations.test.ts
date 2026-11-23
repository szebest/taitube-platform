import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { RETIRED_GENERATION_GRACE_MS } from '@vp/domain';
import { storageUnavailable } from '@vp/errors';
import { masterPlaylistKey, renditionObjectKey } from '@vp/storage';
import { runPurgeGenerations } from '../purge-generations';

const OWNER_ID = '00000000-0000-7000-8000-00000000a001';
const VIDEO_ID = '00000000-0000-7000-8000-00000000a0b1';
const TOKEN = '00000000-0000-7000-8000-00000000a0c1';
const SWAPPED_AT = Date.parse('2026-03-01T12:00:00.000Z');
const LADDER = [{ name: '720p' }];

describe('housekeeping: purge-generations', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  const purge = (afterMs: number) =>
    runPurgeGenerations({
      repositories,
      storage,
      publicBucket: 'public',
      scanLimit: 100,
      now: () => SWAPPED_AT + afterMs,
    });
  const keys = async () =>
    expectOk(await storage.listObjects({ bucket: 'public', prefix: `videos/${VIDEO_ID}/` })).keys;
  const write = (key: string) =>
    storage.uploadObject({ bucket: 'public', key, body: 'x', contentType: 'video/mp2t' });
  const statusOf = async (generation: number) =>
    expectOk(await repositories.videoGenerations.list(VIDEO_ID)).find(
      (row) => row.generation === generation
    )?.status;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER_ID,
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        status: 'READY',
        durationMs: 60_000,
        masterPlaylistKey: masterPlaylistKey(VIDEO_ID),
        ladder: LADDER,
      })
    );
    for (const generation of [1, 2]) {
      expectOk(await write(renditionObjectKey(VIDEO_ID, '720p', 'seg_00000.ts', generation)));
      expectOk(await write(masterPlaylistKey(VIDEO_ID, generation)));
    }
    const generations = repositories.videoGenerations;
    expectOk(
      await generations.openReplacement({
        videoId: VIDEO_ID,
        generation: 2,
        replacesGeneration: 1,
        sourceKey: `raw/${VIDEO_ID}/g2/source.mp4`,
        uploadExpiresAt: new Date(SWAPPED_AT),
      })
    );
    expectOk(
      await generations.startRender(VIDEO_ID, 2, {
        kind: 'apply-edits',
        payload: { type: 'pubsub', channel: 'none', message: '' },
      })
    );
    expectOk(await generations.claim(VIDEO_ID, 2, TOKEN));
    expectOk(
      await generations.swap({
        videoId: VIDEO_ID,
        generation: 2,
        claim: {
          type: 'render',
          lockToken: TOKEN,
          playback: {
            masterPlaylistKey: masterPlaylistKey(VIDEO_ID, 2),
            durationMs: 60_000,
            width: 1280,
            height: 720,
            fps: 30,
            ladder: LADDER,
          },
        },
        now: new Date(SWAPPED_AT),
      })
    );
  });

  it('keeps the old renditions through the grace players need', async () => {
    expect(expectOk(await purge(RETIRED_GENERATION_GRACE_MS - 1))).toEqual({
      purgedCount: 0,
      expiredUploads: 0,
    });
    expect(await keys()).toHaveLength(4);
  });

  it('purges the first generation by its renditions and master, never the one playing', async () => {
    expect(expectOk(await purge(RETIRED_GENERATION_GRACE_MS + 1))).toEqual({
      purgedCount: 1,
      expiredUploads: 0,
    });
    expect(await keys()).toEqual(
      [
        renditionObjectKey(VIDEO_ID, '720p', 'seg_00000.ts', 2),
        masterPlaylistKey(VIDEO_ID, 2),
      ].sort()
    );
    expect(await statusOf(1)).toBe('purged');
  });

  it('stops when storage fails, leaving the claimed generation purged and its objects behind', async () => {
    vi.spyOn(storage, 'purgePrefix').mockResolvedValue(
      err(storageUnavailable.during('purgePrefix')(new Error('down')))
    );

    expectErr(await purge(RETIRED_GENERATION_GRACE_MS + 1));
    expect(await statusOf(1)).toBe('purged');
    expect(await keys()).toHaveLength(4);
  });

  it('keeps the objects of a generation reverted to after it was listed due', async () => {
    const generations = repositories.videoGenerations;
    const listDue = generations.listDue.bind(generations);
    vi.spyOn(generations, 'listDue').mockImplementationOnce(async (now, limit) => {
      const due = await listDue(now, limit);
      const playing = expectOk(await repositories.videos.findById(VIDEO_ID));
      expectOk(
        await generations.swap({
          videoId: VIDEO_ID,
          generation: 1,
          claim: { type: 'revert', expectedVersion: playing?.version ?? 0 },
          now: new Date(SWAPPED_AT),
        })
      );
      return due;
    });

    expect(expectOk(await purge(RETIRED_GENERATION_GRACE_MS + 1))).toEqual({
      purgedCount: 0,
      expiredUploads: 0,
    });
    expect(await statusOf(1)).toBe('active');
    expect(await keys()).toHaveLength(4);
  });

  it('fails a replacement whose upload lapsed, leaving the video as it is', async () => {
    expectOk(
      await repositories.videoGenerations.openReplacement({
        videoId: VIDEO_ID,
        generation: 3,
        replacesGeneration: 2,
        sourceKey: `raw/${VIDEO_ID}/g3/source.mp4`,
        uploadExpiresAt: new Date(SWAPPED_AT + 1_000),
      })
    );

    expect(expectOk(await purge(2_000))).toEqual({ purgedCount: 0, expiredUploads: 1 });
    expect(await statusOf(3)).toBe('failed');
    expect(expectOk(await repositories.videos.findById(VIDEO_ID))?.generation).toBe(2);
  });
});
