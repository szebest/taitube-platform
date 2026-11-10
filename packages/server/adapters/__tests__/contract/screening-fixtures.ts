import type { NewScreeningInput } from '@vp/core/repositories';
import type { ScreeningReason } from '@vp/domain';
import { OTHER_OWNER_ID, VIDEO_IDS } from './fixtures';

export const MODERATOR_A = OTHER_OWNER_ID;
export const MODERATOR_B = '00000000-0000-7000-8000-000000000103';
export const SCREENING_ID = '00000000-0000-7000-8000-0000000005a1';
export const APPEAL_ID = '00000000-0000-7000-8000-0000000005b1';

export const finding = (reason: ScreeningReason, score: number) => ({
  reason,
  score,
  evidence: { matchedVideoId: VIDEO_IDS.b },
});

export const screening = (overrides: Partial<NewScreeningInput> = {}): NewScreeningInput => ({
  id: SCREENING_ID,
  videoId: VIDEO_IDS.a,
  sourceChecksum: 'sum-1',
  outcome: 'HOLD',
  score: 0.93,
  reasons: [finding('DUPLICATE', 0.93)],
  flags: [],
  modelVersion: 'nsfw-classifier',
  thresholdVersion: 'v1',
  ...overrides,
});
