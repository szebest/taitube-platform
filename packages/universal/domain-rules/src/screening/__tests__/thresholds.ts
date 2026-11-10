import type { ScreeningThresholds } from '@vp/domain';

export const THRESHOLDS: ScreeningThresholds = {
  version: 'test',
  frameMaxHamming: 3,
  duplicateCoverage: 0.9,
  partialCoverage: 0.3,
  partialRunSeconds: 30,
  audioMaxBitErrorRate: 0.35,
  nsfwFrameThreshold: 0.85,
  nsfwShareThreshold: 0.1,
  blankFrameShare: 0.95,
  blankMaxHamming: 2,
  blankMaxLumaRange: 8,
  blankMinFrames: 3,
  spamMaxLinks: 3,
  spamMaxTags: 30,
  spamMaxRepeatShare: 0.5,
  spamMaxCapsShare: 0.7,
  spamSignalWeight: 0.4,
  spamHoldScore: 0.8,
};
