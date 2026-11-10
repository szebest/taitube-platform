import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { SCREENING_EVIDENCE_RETENTION_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { storageUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { evidenceFrameKey } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runPurgeScreeningEvidence } from '../purge-screening-evidence';
import { seedVideo } from './housekeeping-harness';

const LOOKUP = { minBandSetBits: 2, minTermSetBits: 4, maxHitsPerKey: 10 };

const MODERATOR = '00000000-0000-7000-8000-00000000a0a1';

describe('housekeeping: purge-screening-evidence', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  async function closedCase(decide: 'approve' | 'reject' | 'none') {
    const video = await seedVideo(repositories, { status: 'HELD' });
    expectOk(
      await repositories.screenings.record({
        id: uuidv7(),
        videoId: video.id,
        sourceChecksum: 'sum',
        outcome: 'HOLD',
        score: 0.9,
        reasons: [{ reason: 'NSFW', score: 0.9, evidence: {} }],
        flags: [],
        modelVersion: null,
        thresholdVersion: 'v1',
      })
    );
    await storage.uploadObject({
      bucket: 'raw',
      key: evidenceFrameKey(video.id, 0),
      body: 'jpeg',
      contentType: 'image/jpeg',
    });
    if (decide === 'approve') {
      expectOk(
        await repositories.screenings.approve({ videoId: video.id, moderatorId: MODERATOR })
      );
    }
    if (decide === 'reject') {
      expectOk(
        await repositories.screenings.reject({
          videoId: video.id,
          moderatorId: MODERATOR,
          reason: 'no',
        })
      );
    }
    return video.id;
  }

  const purgeAfter = async (days: number, purge = storage) =>
    expectOk(
      await runPurgeScreeningEvidence({
        repositories,
        storage: purge,
        rawBucket: 'raw',
        retentionDays: SCREENING_EVIDENCE_RETENTION_DAYS,
        scanLimit: 100,
        now: () => Date.now() + days * MS_PER_DAY,
      })
    );
  const kept = async (videoId: string) =>
    expectOk(await storage.headObject('raw', evidenceFrameKey(videoId, 0))) !== null;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  it.each([
    {
      scenario: 'a rejected case inside the 30 days',
      decide: 'reject',
      days: 29,
      purged: 0,
      kept: true,
    },
    {
      scenario: 'a rejected case past the 30 days',
      decide: 'reject',
      days: 31,
      purged: 1,
      kept: false,
    },
    {
      scenario: 'an approved case past the 30 days',
      decide: 'approve',
      days: 31,
      purged: 1,
      kept: false,
    },
    {
      scenario: 'a case nobody decided, however old',
      decide: 'none',
      days: 400,
      purged: 0,
      kept: true,
    },
  ] as const)('handles $scenario', async ({ decide, days, purged, kept: stays }) => {
    const videoId = await closedCase(decide);

    expect(await purgeAfter(days)).toEqual({ purgedCount: purged });

    expect(await kept(videoId)).toBe(stays);
  });

  it('removes a case once, and keeps the fingerprints of a rejected video', async () => {
    const videoId = await closedCase('reject');
    expectOk(await repositories.fingerprints.storeFrames(videoId, [{ idx: 0, hash: 7n }]));

    expect(await purgeAfter(31)).toEqual({ purgedCount: 1 });
    expect(await purgeAfter(31)).toEqual({ purgedCount: 0 });

    const hits = expectOk(
      await repositories.fingerprints.findFramesSharingBand([7n], uuidv7(), LOOKUP)
    );
    expect(hits).toHaveLength(1);
  });

  it('keeps the case for the next run when the storage fails', async () => {
    const videoId = await closedCase('reject');
    const failing = Object.create(storage) as InMemoryStorageClient;
    failing.purgePrefix = async () => err(storageUnavailable('purgePrefix'));

    expect(await purgeAfter(31, failing)).toEqual({ purgedCount: 0 });
    expect(await kept(videoId)).toBe(true);

    expect(await purgeAfter(31)).toEqual({ purgedCount: 1 });
  });
});
