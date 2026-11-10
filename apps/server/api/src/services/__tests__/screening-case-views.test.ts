import type { ScreeningCase } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { ScreeningCaseViews } from '../screening-case-views';
import {
  HELD_ID,
  ORIGINAL_ID,
  SCREENING_ID,
  duplicate,
  screeningHarness,
} from './screening-harness';
import { TEST_CDN } from './service-deps';

describe('apps/server/api/services: screening case views', () => {
  let h: ReturnType<typeof screeningHarness>;
  let views: ScreeningCaseViews;

  beforeEach(async () => {
    h = screeningHarness();
    await h.seedHeld();
    views = new ScreeningCaseViews({
      videos: h.repositories.videos,
      channels: h.repositories.channels,
      storage: h.storage,
      rawBucket: 'raw',
      frameUrlTtlSeconds: 60,
      cdn: TEST_CDN,
    });
  });

  const caseOf = async (): Promise<ScreeningCase> => {
    const screening = expectOk(await h.repositories.screenings.latestForVideo(HELD_ID));
    if (!screening) throw new Error('no screening');
    return { screening, appeal: null };
  };

  it('reads a finding whose evidence is malformed as a finding with nothing to show', async () => {
    const found = await caseOf();
    found.screening.reasons = [
      { reason: 'DUPLICATE', score: 0.9, evidence: { matchedVideoId: 7, video: 'x', frames: 3 } },
    ];

    const [view] = expectOk(await views.toViews([found]));

    expect(view?.reasons[0]).toEqual({
      reason: 'DUPLICATE',
      score: 0.9,
      match: null,
      frames: [],
      flaggedShare: null,
      signals: [],
      profanity: [],
    });
  });

  it('names a matched video that is gone by its id alone', async () => {
    const matched = 'f00dfeed-0000-7000-8000-000000000000';
    const found = await caseOf();
    found.screening.reasons = [
      { ...duplicate, evidence: { ...duplicate.evidence, matchedVideoId: matched } },
    ];

    const [view] = expectOk(await views.toViews([found]));

    expect(view?.reasons[0]?.match).toMatchObject({
      id: matched,
      title: null,
      channel: null,
      status: null,
    });
  });

  it('shows a case whose video is gone as deleted, and sorts the match range by the offset', async () => {
    const found = await caseOf();
    found.screening.videoId = '00000000-0000-7000-8000-0000000006ff';

    const [view] = expectOk(await views.toViews([found]));

    expect(view).toMatchObject({ id: SCREENING_ID, status: 'DELETED', title: null, channel: null });
    expect(view?.reasons[0]?.match).toMatchObject({
      id: ORIGINAL_ID,
      matchedRange: { fromSeconds: 15, toSeconds: 75 },
    });
  });

  it('answers an empty page with an empty list', async () => {
    expect(expectOk(await views.toViews([]))).toEqual([]);
  });
});
