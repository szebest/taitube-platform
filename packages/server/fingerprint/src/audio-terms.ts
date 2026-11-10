import type { AudioTerm } from '@vp/core/repositories';
import { popcount32 } from '@vp/domain';

export const TERM_BITS = 32;

/** Seconds of audio one Chromaprint item covers: a hop of 1365 samples at 11 025 Hz. */
export const CHROMAPRINT_ITEM_SECONDS = 1365 / 11_025;

/** Every `stride`th term with its position, the subsample the inverted index keeps. */
export function audioIndexTerms(terms: readonly number[], stride: number): AudioTerm[] {
  const kept: AudioTerm[] = [];
  for (let idx = 0; idx < terms.length; idx += stride) {
    kept.push({ idx, term: terms[idx] ?? 0 });
  }
  return kept;
}

export function bitErrors(a: number, b: number): number {
  return popcount32(a ^ b);
}
