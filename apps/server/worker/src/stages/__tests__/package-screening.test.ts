import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ScreenResult } from '@vp/job-contracts';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { screeningGate } from '../package-screening';

const result = (outcome: 'PASS' | 'HOLD'): ScreenResult => ({
  type: 'screen',
  screeningId: uuidv7(),
  outcome,
  score: 0.9,
  reasons: outcome === 'HOLD' ? ['BLANK'] : [],
});

describe('screeningGate', () => {
  let repositories: InMemoryRepositories;
  let videoId: string;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    videoId = uuidv7();
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: SEEDED.userId,
        title: 't',
        status: 'PROCESSING',
        sourceKey: 'raw/x.mp4',
      })
    );
  });

  const gate = async (screened: boolean | undefined, screen: ScreenResult | undefined) =>
    expectOk(
      await screeningGate({
        repositories,
        videoId,
        generation: 1,
        screened,
        screen,
        thresholdVersion: 'v1',
      })
    );
  const status = async () => expectOk(await repositories.videos.findById(videoId))?.status;

  it.each([
    { scenario: 'a flow without a screen child', screened: undefined, screen: undefined },
    { scenario: 'screening switched off', screened: false, screen: result('HOLD') },
    { scenario: 'a passing result', screened: true, screen: result('PASS') },
  ])('lets $scenario through and leaves the video as it was', async ({ screened, screen }) => {
    expect(await gate(screened, screen)).toBe('proceed');
    expect(await status()).toBe('PROCESSING');
  });

  it('holds the video on a HOLD result', async () => {
    expect(await gate(true, result('HOLD'))).toBe('held');
    expect(await status()).toBe('HELD');
  });

  it('holds the video, recording SCREEN_ERROR, when a screened flow brought no result', async () => {
    expect(await gate(true, undefined)).toBe('held');

    expect(await status()).toBe('HELD');
    const stored = expectOk(await repositories.screenings.latestForVideo(videoId));
    expect(stored).toMatchObject({ outcome: 'HOLD', thresholdVersion: 'v1', modelVersion: null });
    expect(stored?.reasons.map((finding) => finding.reason)).toEqual(['SCREEN_ERROR']);
  });

  it('does not hold a video a moderator approved, whatever the result says', async () => {
    expectOk(
      await repositories.screenings.record({
        id: uuidv7(),
        videoId,
        sourceChecksum: 'c',
        outcome: 'HOLD',
        score: 1,
        reasons: [{ reason: 'BLANK', score: 1, evidence: {} }],
        flags: [],
        modelVersion: null,
        thresholdVersion: 'v1',
      })
    );
    await gate(true, result('HOLD'));
    expectOk(await repositories.screenings.approve({ videoId, moderatorId: SEEDED.userId }));

    expect(await gate(true, result('HOLD'))).toBe('proceed');
    expect(await status()).toBe('PROCESSING');
  });

  it('answers held again for a video already held, without a second state change', async () => {
    await gate(true, result('HOLD'));

    expect(await gate(true, result('HOLD'))).toBe('held');
    expect(await status()).toBe('HELD');
  });
});
