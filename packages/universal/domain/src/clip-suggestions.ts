import type { Chapter } from './chapters';
import { RETENTION_FULL_PERCENT, type RetentionPoint } from './retention';

const CLIP_SUGGESTION_LENGTHS_MS = [15_000, 30_000, 45_000] as const;
export const MAX_CLIP_SUGGESTIONS = 3;
const START_STEP_MS = 5_000;

export interface ClipSuggestion {
  startMs: number;
  endMs: number;
  /** Of the viewers who started the video, the share this window lost, from 0 to 1. */
  lostShare: number;
  chapterTitle: string | null;
}

interface Candidate extends ClipSuggestion {
  score: number;
}

function viewersAt(curve: readonly RetentionPoint[], percent: number): number {
  const after = curve.findIndex((point) => point.percent >= percent);
  if (after <= 0) return curve[Math.max(after, 0)]?.viewers ?? 0;
  const high = curve[after];
  const low = curve[after - 1];
  if (!high || !low) return 0;
  const share = (percent - low.percent) / (high.percent - low.percent);
  return low.viewers + (high.viewers - low.viewers) * share;
}

function chapterAt(chapters: readonly Chapter[], ms: number): string | null {
  return chapters.filter(({ startMs }) => startMs <= ms).at(-1)?.title ?? null;
}

/**
 * Up to three non-overlapping windows of 15 to 45 seconds where viewers were lost least compared with
 * the same length just before and after them: the stretches people stayed for. Pure arithmetic over the
 * retention curve; a curve nobody has started yet suggests nothing.
 */
export function suggestClips(input: {
  curve: readonly RetentionPoint[];
  durationMs: number;
  chapters: readonly Chapter[];
}): ClipSuggestion[] {
  const { durationMs, chapters } = input;
  const curve = input.curve.toSorted((a, b) => a.percent - b.percent);
  const started = viewersAt(curve, 0);
  if (started <= 0 || durationMs <= 0) return [];

  const percentOf = (ms: number) => (ms / durationMs) * RETENTION_FULL_PERCENT;
  const lossRate = (fromMs: number, toMs: number) =>
    Math.max(0, viewersAt(curve, percentOf(fromMs)) - viewersAt(curve, percentOf(toMs))) /
    started /
    (toMs - fromMs);

  const candidates: Candidate[] = [];
  for (const length of CLIP_SUGGESTION_LENGTHS_MS) {
    for (let startMs = 0; startMs + length <= durationMs; startMs += START_STEP_MS) {
      const endMs = startMs + length;
      const neighbours = [
        { fromMs: Math.max(0, startMs - length), toMs: startMs },
        { fromMs: endMs, toMs: Math.min(durationMs, endMs + length) },
      ].filter(({ fromMs, toMs }) => toMs > fromMs);
      const rate = lossRate(startMs, endMs);
      const around =
        neighbours.length === 0
          ? rate
          : neighbours.reduce((sum, { fromMs, toMs }) => sum + lossRate(fromMs, toMs), 0) /
            neighbours.length;
      candidates.push({
        startMs,
        endMs,
        lostShare: rate * length,
        chapterTitle: chapterAt(chapters, startMs),
        score: rate - around,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      a.score - b.score || b.endMs - b.startMs - (a.endMs - a.startMs) || a.startMs - b.startMs
  );
  const picked: Candidate[] = [];
  for (const candidate of candidates) {
    if (picked.length === MAX_CLIP_SUGGESTIONS) break;
    if (picked.every((p) => candidate.endMs <= p.startMs || candidate.startMs >= p.endMs)) {
      picked.push(candidate);
    }
  }
  return picked
    .sort((a, b) => a.startMs - b.startMs)
    .map(({ startMs, endMs, lostShare, chapterTitle }) => ({
      startMs,
      endMs,
      lostShare,
      chapterTitle,
    }));
}
