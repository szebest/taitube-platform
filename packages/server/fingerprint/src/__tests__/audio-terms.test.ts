import { CHROMAPRINT_ITEM_SECONDS, audioIndexTerms, bitErrors } from '../audio-terms';

describe('@vp/fingerprint: audioIndexTerms', () => {
  it.each([
    { name: 'nothing', terms: [], stride: 4, kept: [] },
    { name: 'a short sequence', terms: [5], stride: 4, kept: [{ idx: 0, term: 5 }] },
    {
      name: 'every fourth term',
      terms: [10, 11, 12, 13, 14, 15, 16, 17, 18],
      stride: 4,
      kept: [
        { idx: 0, term: 10 },
        { idx: 4, term: 14 },
        { idx: 8, term: 18 },
      ],
    },
    {
      name: 'every term at stride one',
      terms: [1, 2],
      stride: 1,
      kept: [
        { idx: 0, term: 1 },
        { idx: 1, term: 2 },
      ],
    },
  ])('keeps $name', ({ terms, stride, kept }) => {
    expect(audioIndexTerms(terms, stride)).toEqual(kept);
  });

  it('stays under 4000 rows for an hour of audio at the shipped stride of 8', () => {
    const hour = Math.ceil(3600 / CHROMAPRINT_ITEM_SECONDS);

    expect(audioIndexTerms(new Array<number>(hour).fill(0), 8).length).toBeLessThan(4000);
  });
});

describe('@vp/fingerprint: bitErrors', () => {
  it.each([
    { a: 0, b: 0, errors: 0 },
    { a: 0b1010, b: 0b0110, errors: 2 },
    { a: -1, b: 0, errors: 32 },
    { a: 0x7fffffff, b: -0x80000000, errors: 32 },
  ])('counts $errors between $a and $b', ({ a, b, errors }) => {
    expect(bitErrors(a, b)).toBe(errors);
  });
});
