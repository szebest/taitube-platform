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

/** Evidence frames are kept this long after a case closes, then housekeeping removes them. */
export const SCREENING_EVIDENCE_RETENTION_DAYS = 30;

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
  spamSignalWeight: number;
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
  /** Set when a moderator reviews the flags, cleared when a new flag is raised. */
  flagsClearedAt: Date | null;
  evidencePurgedAt: Date | null;
  createdAt: Date;
}

/** A case is open while a hold waits for a person or a flag has not been looked at. */
export function isScreeningCaseOpen(
  screening: Pick<VideoScreening, 'outcome' | 'decision' | 'flags' | 'flagsClearedAt'>
): boolean {
  const heldAndUndecided = screening.outcome === 'HOLD' && screening.decision === null;
  const flagged = screening.flags.length > 0 && screening.flagsClearedAt === null;
  return heldAndUndecided || flagged;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface FlagMerge {
  flags: ScreeningFinding[];
  /** Whether the finding is news: the same finding again is not raised twice, even after a dismissal. */
  changed: boolean;
}

/** Where a finding was read: the text of the video by default, or what is said in it. */
function sourceOf(finding: ScreeningFinding): string {
  const { source } = finding.evidence;
  return typeof source === 'string' ? source : '';
}

/** One flag per reason and source: a fresh finding replaces the older one of the same two. */
export function mergeFlag(
  flags: readonly ScreeningFinding[],
  finding: ScreeningFinding
): FlagMerge {
  const same = (flag: ScreeningFinding) =>
    flag.reason === finding.reason && sourceOf(flag) === sourceOf(finding);
  const current = flags.find(same);
  if (current && canonical(current) === canonical(finding)) {
    return { flags: [...flags], changed: false };
  }
  return { flags: [...flags.filter((flag) => !same(flag)), finding], changed: true };
}

/** The source checksum of a result made of flags alone, for a video that was never screened. */
export const FLAG_ONLY_CHECKSUM = 'flags';

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

/**
 * What a creator is told. A near-total match and a match with a taken-down video are one reason,
 * because neither says whose video it matched, and a partial match never holds.
 */
export const CREATOR_SCREENING_REASONS = [
  'DUPLICATE',
  'NSFW',
  'BLANK',
  'METADATA_SPAM',
  'SCREEN_ERROR',
] as const;
export type CreatorScreeningReason = (typeof CREATOR_SCREENING_REASONS)[number];

export function creatorScreeningReasons(
  findings: readonly Pick<ScreeningFinding, 'reason'>[]
): CreatorScreeningReason[] {
  const told = findings.flatMap(({ reason }): CreatorScreeningReason[] => {
    switch (reason) {
      case 'DUPLICATE':
      case 'KNOWN_REJECTED':
        return ['DUPLICATE'];
      case 'PARTIAL_MATCH':
        return [];
      default:
        return [reason];
    }
  });
  return CREATOR_SCREENING_REASONS.filter((reason) => told.includes(reason));
}
