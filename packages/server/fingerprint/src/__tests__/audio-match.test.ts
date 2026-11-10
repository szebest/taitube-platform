import type { AudioTerm, AudioTermHit } from '@vp/core/repositories';
import { alignAudio, verifyAudio } from '../audio-match';
import { CHROMAPRINT_ITEM_SECONDS } from '../audio-terms';

const STRIDE = 4;
const OPTIONS = { maxBitErrorRate: 0.35, stride: STRIDE };

function termAt(i: number, family = 0): number {
  let x = i + 1 + family * 100_000;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) | 0;
}
const sequence = (length: number, family = 0) =>
  Array.from({ length }, (_, i) => termAt(i, family));
const subsample = (terms: number[]): AudioTerm[] =>
  terms.flatMap((term, idx) => (idx % STRIDE === 0 ? [{ idx, term }] : []));
const hitsOf = (videoId: string, stored: AudioTerm[], queryTerms: number[]): AudioTermHit[] => {
  const wanted = new Set(queryTerms);
  return stored.filter(({ term }) => wanted.has(term)).map((entry) => ({ videoId, ...entry }));
};

const ORIGINAL = sequence(200);
const STORED = subsample(ORIGINAL);

describe('@vp/fingerprint: alignAudio', () => {
  it.each([
    { name: 'a copy from the start', query: ORIGINAL, offset: 0 },
    {
      name: 'a copy that starts 37 terms in, not on a multiple of the stride',
      query: ORIGINAL.slice(37),
      offset: 37,
    },
    { name: 'a copy that starts 2 terms in', query: ORIGINAL.slice(2, 120), offset: 2 },
  ])('finds the offset of $name', ({ query, offset }) => {
    const [aligned] = alignAudio(query, hitsOf('orig', STORED, query));

    expect(aligned).toMatchObject({ videoId: 'orig', offset });
    expect(aligned?.votes).toBeGreaterThan(query.length / STRIDE / 2);
  });

  it('ranks candidates by their votes and keeps none for no hits', () => {
    const query = ORIGINAL.slice(0, 100);
    const weak = hitsOf('weak', STORED.slice(0, 5), query);
    const strong = hitsOf('strong', STORED, query);

    expect(alignAudio(query, [...weak, ...strong]).map((a) => a.videoId)).toEqual([
      'strong',
      'weak',
    ]);
    expect(alignAudio(query, [])).toEqual([]);
  });

  it('keeps at most twenty candidates', () => {
    const hits = Array.from({ length: 30 }, (_, i) => hitsOf(`v${i}`, STORED, ORIGINAL)).flat();

    expect(alignAudio(ORIGINAL, hits)).toHaveLength(20);
  });
});

describe('@vp/fingerprint: verifyAudio', () => {
  const slot = STRIDE * CHROMAPRINT_ITEM_SECONDS;

  it('covers the whole of an exact copy with no bit errors', () => {
    const match = verifyAudio(ORIGINAL, STORED, 0, OPTIONS);

    expect(match).toMatchObject({ coverage: 1, bitErrorRate: 0 });
    expect(match?.longestRunSeconds).toBeCloseTo(50 * slot);
    expect(match?.runFromSeconds).toBe(0);
  });

  it('measures a 35 percent excerpt as 35 percent', () => {
    const query = [...ORIGINAL.slice(0, 70), ...sequence(130, 3)];

    const match = verifyAudio(query, STORED, 0, OPTIONS);

    expect(match?.coverage).toBeCloseTo(0.35, 1);
    expect(match?.longestRunSeconds).toBeCloseTo(18 * slot, 0);
    expect(match?.runFromSeconds).toBe(0);
  });

  it('accepts a few flipped bits per term and reports the rate', () => {
    const noisy = ORIGINAL.map((term) => term ^ 0b1000_0001_0000_0000_0001);

    const match = verifyAudio(noisy, STORED, 0, OPTIONS);

    expect(match?.coverage).toBe(1);
    expect(match?.bitErrorRate).toBeCloseTo(3 / 32);
  });

  it('reads an offset that is not a multiple of the stride', () => {
    const query = ORIGINAL.slice(37, 137);

    const match = verifyAudio(query, STORED, 37, OPTIONS);

    expect(match?.coverage).toBeGreaterThan(0.95);
    expect(match?.bitErrorRate).toBe(0);
  });

  it('scores unrelated audio near zero, a chance term or two aside', () => {
    expect(verifyAudio(sequence(200, 9), STORED, 0, OPTIONS)?.coverage ?? 0).toBeLessThan(0.1);
  });

  it('is null with nothing stored or nothing overlapping', () => {
    expect(verifyAudio(ORIGINAL, [], 0, OPTIONS)).toBeNull();
    expect(verifyAudio(ORIGINAL, STORED, 10_000, OPTIONS)).toBeNull();
  });
});
