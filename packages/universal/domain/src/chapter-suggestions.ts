import type { TranscriptCue } from './captions';
import type { Chapter } from './chapters';
import { CHAPTER_MIN_GAP_MS, CHAPTER_TITLE_MAX_LENGTH } from './chapters';
import { stopWordsFor } from './stop-words';

export const SUGGESTION_WINDOW_MS = 30_000;
export const SUGGESTION_MIN_SPAN_MS = 90_000;
export const SUGGESTION_SILENCE_MS = 2_500;
export const SUGGESTION_SIMILARITY_THRESHOLD = 0.2;
export const SUGGESTION_MAX_COUNT = 12;
const TITLE_TERMS = 3;
const MIN_UNLISTED_TERM_LENGTH = 4;

type TermVector = ReadonlyMap<string, number>;

interface Boundary {
  startMs: number;
  similarity: number;
}

function termsOf(text: string, stop: ReadonlySet<string> | null): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return stop
    ? words.filter((word) => word.length > 1 && !stop.has(word))
    : words.filter((word) => word.length >= MIN_UNLISTED_TERM_LENGTH);
}

function vectorsOf(
  cues: readonly TranscriptCue[],
  windows: number,
  stop: ReadonlySet<string> | null
): Map<string, number>[] {
  const vectors = Array.from({ length: windows }, () => new Map<string, number>());
  for (const cue of cues) {
    const vector = vectors[Math.min(windows - 1, Math.floor(cue.startMs / SUGGESTION_WINDOW_MS))];
    for (const term of termsOf(cue.text, stop)) vector?.set(term, (vector.get(term) ?? 0) + 1);
  }
  return vectors;
}

function cosine(a: TermVector, b: TermVector): number {
  let dot = 0;
  for (const [term, weight] of a) dot += weight * (b.get(term) ?? 0);
  const norm = (vector: TermVector) =>
    Math.sqrt([...vector.values()].reduce((sum, weight) => sum + weight * weight, 0));
  const denominator = norm(a) * norm(b);
  return denominator === 0 ? 1 : dot / denominator;
}

function silenceEnds(cues: readonly TranscriptCue[]): number[] {
  return cues.flatMap((cue, index) => {
    const previous = cues[index - 1];
    return previous && cue.startMs - previous.endMs >= SUGGESTION_SILENCE_MS ? [cue.startMs] : [];
  });
}

function nearestSilence(startMs: number, silences: readonly number[]): number {
  const reach = SUGGESTION_WINDOW_MS / 2;
  const near = silences.filter((end) => Math.abs(end - startMs) <= reach);
  return near.reduce(
    (best, end) => (Math.abs(end - startMs) < Math.abs(best - startMs) ? end : best),
    near[0] ?? startMs
  );
}

function titleOf(
  vectors: readonly TermVector[],
  from: number,
  to: number,
  position: number
): string {
  const weights = new Map<string, number>();
  for (let index = from; index < to; index++) {
    for (const [term, count] of vectors[index] ?? [])
      weights.set(term, (weights.get(term) ?? 0) + count);
  }
  const documentFrequency = (term: string) => vectors.filter((vector) => vector.has(term)).length;
  const weighted = [...weights].map(
    ([term, count]) =>
      [term, count * Math.log(1 + vectors.length / documentFrequency(term))] as const
  );
  const top = weighted
    .sort(([termA, a], [termB, b]) => b - a || termA.localeCompare(termB))
    .slice(0, TITLE_TERMS)
    .map(([term]) => term);
  const title = top.join(', ');
  return title
    ? `${title[0]?.toUpperCase()}${title.slice(1)}`.slice(0, CHAPTER_TITLE_MAX_LENGTH)
    : `Part ${position}`;
}

function candidatesOf(
  vectors: readonly TermVector[],
  silences: readonly number[],
  listed: boolean
): Boundary[] {
  if (!listed) return silences.map((startMs) => ({ startMs, similarity: 0 }));
  return vectors.slice(1).flatMap((vector, index) => {
    const similarity = cosine(vectors[index] ?? new Map(), vector);
    if (similarity >= SUGGESTION_SIMILARITY_THRESHOLD) return [];
    return [{ startMs: nearestSilence((index + 1) * SUGGESTION_WINDOW_MS, silences), similarity }];
  });
}

function spaced(candidates: readonly Boundary[], durationMs: number): Boundary[] {
  const kept: Boundary[] = [];
  let last = 0;
  for (const candidate of [...candidates].sort((a, b) => a.startMs - b.startMs)) {
    if (candidate.startMs - last < SUGGESTION_MIN_SPAN_MS) continue;
    if (durationMs - candidate.startMs < CHAPTER_MIN_GAP_MS) continue;
    kept.push(candidate);
    last = candidate.startMs;
  }
  return kept;
}

/**
 * Pure and deterministic: windows of 30 seconds, a term vector per window, a boundary where adjacent
 * windows stop resembling each other and 90 seconds have passed, moved to a nearby silence of 2.5
 * seconds or more. A language without a stop list cuts at pauses only.
 */
export function suggestChapters(
  cues: readonly TranscriptCue[],
  options: { durationMs: number; language: string | null }
): Chapter[] {
  const { durationMs, language } = options;
  const ordered = [...cues].sort((a, b) => a.startMs - b.startMs);
  if (ordered.length === 0 || durationMs <= 0) return [];

  const stop = stopWordsFor(language);
  const windows = Math.max(1, Math.ceil(durationMs / SUGGESTION_WINDOW_MS));
  const vectors = vectorsOf(ordered, windows, stop);

  const found = spaced(candidatesOf(vectors, silenceEnds(ordered), stop !== null), durationMs);
  const chosen = [...found]
    .sort((a, b) => a.similarity - b.similarity || a.startMs - b.startMs)
    .slice(0, SUGGESTION_MAX_COUNT - 1)
    .sort((a, b) => a.startMs - b.startMs);

  const starts = [0, ...chosen.map(({ startMs }) => startMs)];
  const windowOf = (ms: number) => Math.min(windows, Math.ceil(ms / SUGGESTION_WINDOW_MS));
  return starts.map((startMs, index) => ({
    startMs,
    title: titleOf(
      vectors,
      Math.floor(startMs / SUGGESTION_WINDOW_MS),
      index + 1 < starts.length ? windowOf(starts[index + 1] ?? durationMs) : windows,
      index + 1
    ),
  }));
}
