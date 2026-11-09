import type { VideoStatus } from './status-vocabulary';

export const SCREENING_OUTCOMES = ['PASS', 'HOLD'] as const;
export type ScreeningOutcome = (typeof SCREENING_OUTCOMES)[number];

export const SCREENING_REASONS = [
  'DUPLICATE',
  'PARTIAL_MATCH',
  'KNOWN_REJECTED',
  'NSFW',
  'BLANK',
  'METADATA_SPAM',
  'SCREEN_ERROR',
] as const;
export type ScreeningReason = (typeof SCREENING_REASONS)[number];

export const SCREENING_DECISIONS = ['approved', 'rejected', 'dismissed'] as const;
export type ScreeningDecision = (typeof SCREENING_DECISIONS)[number];

/** Why a video was held or flagged, with the number a moderator reads and the proof behind it. */
export interface ScreeningFinding {
  reason: ScreeningReason;
  score: number;
  evidence: Readonly<Record<string, unknown>>;
}

/**
 * What the screening is judged against. The version names the set, and each result stores it, so
 * changing a number never rewrites what an earlier result was decided under.
 */
export interface ScreeningThresholds {
  version: string;
  frameMaxHamming: number;
  duplicateCoverage: number;
  partialCoverage: number;
  partialRunSeconds: number;
  audioMaxBitErrorRate: number;
  nsfwFrameThreshold: number;
  nsfwShareThreshold: number;
  blankFrameShare: number;
  blankMaxHamming: number;
  blankMaxLumaRange: number;
  spamMaxLinks: number;
  spamMaxTags: number;
  spamMaxRepeatShare: number;
  spamMaxCapsShare: number;
  spamHoldScore: number;
}

export interface VideoScreening {
  id: string;
  videoId: string;
  sourceChecksum: string;
  outcome: ScreeningOutcome;
  score: number;
  reasons: ScreeningFinding[];
  flags: ScreeningFinding[];
  modelVersion: string | null;
  thresholdVersion: string;
  decision: ScreeningDecision | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

export interface ScreeningAppeal {
  id: string;
  videoId: string;
  screeningId: string;
  authorId: string;
  message: string;
  rejectedBy: string | null;
  createdAt: Date;
  resolvedBy: string | null;
  resolvedAt: Date | null;
}

export type ScreeningTransitionName = 'hold' | 'approve' | 'reject' | 'appeal';

export interface ScreeningTransitionEdge {
  from: VideoStatus;
  to: VideoStatus;
  event: string;
}

/**
 * The four edges that touch `HELD`: the screening holds a processing video, a moderator approves
 * it back into the pipeline or rejects it, and the owner appeals a screening rejection. Nothing
 * else enters or leaves the state.
 */
export const SCREENING_TRANSITIONS = {
  hold: { from: 'PROCESSING', to: 'HELD', event: 'video.held' },
  approve: { from: 'HELD', to: 'PROCESSING', event: 'video.screening_approved' },
  reject: { from: 'HELD', to: 'REJECTED', event: 'video.screening_rejected' },
  appeal: { from: 'REJECTED', to: 'HELD', event: 'video.screening_appealed' },
} as const satisfies Record<ScreeningTransitionName, ScreeningTransitionEdge>;
