import {
  frameBands,
  hammingDistance,
  isLowEntropy,
  isLowEntropyTerm,
  lookupBands,
  popcount32,
} from '../frame-hash';

describe('@vp/domain: hammingDistance', () => {
  it.each([
    { name: 'equal hashes', a: 0xdeadbeefn, b: 0xdeadbeefn, distance: 0 },
    { name: 'one low bit', a: 0n, b: 1n, distance: 1 },
    { name: 'one high bit', a: 0n, b: 1n << 63n, distance: 1 },
    { name: 'bits in both halves', a: 0n, b: (1n << 63n) | 0b101n, distance: 3 },
    { name: 'every bit', a: 0n, b: 0xffffffffffffffffn, distance: 64 },
    { name: 'a signed value', a: -1n, b: 0n, distance: 64 },
  ])('counts $distance for $name', ({ a, b, distance }) => {
    expect(hammingDistance(a, b)).toBe(distance);
    expect(hammingDistance(b, a)).toBe(distance);
  });
});

describe('@vp/domain: frameBands', () => {
  it.each([
    { name: 'zero', hash: 0n, bands: [0, 0, 0, 0] },
    {
      name: 'one bit per band',
      hash: 0x8000_4000_2000_1000n,
      bands: [0x1000, 0x2000, 0x4000, 0x8000],
    },
    { name: 'every bit', hash: 0xffff_ffff_ffff_ffffn, bands: [0xffff, 0xffff, 0xffff, 0xffff] },
    { name: 'a signed value', hash: -1n, bands: [0xffff, 0xffff, 0xffff, 0xffff] },
  ])('splits $name', ({ hash, bands }) => {
    expect(frameBands(hash)).toEqual(bands);
  });

  it('leaves a band shared by hashes within distance 3, whichever bits flip', () => {
    const base = 0x0123_4567_89ab_cdefn;

    for (const flips of [
      [0, 20, 40],
      [15, 16, 31],
      [63, 62, 61],
      [0, 1, 2],
    ]) {
      const near = flips.reduce((hash, bit) => hash ^ (1n << BigInt(bit)), base);
      const shared = frameBands(base).some((band, index) => band === frameBands(near)[index]);

      expect(hammingDistance(base, near)).toBe(3);
      expect(shared).toBe(true);
    }
  });
});

describe('@vp/domain: popcount32', () => {
  it.each([
    { value: 0, bits: 0 },
    { value: 1, bits: 1 },
    { value: 0xff, bits: 8 },
    { value: -1, bits: 32 },
    { value: 0x8000_0000, bits: 1 },
    { value: 0xffff_ffff, bits: 32 },
  ])('counts $bits bits in $value', ({ value, bits }) => {
    expect(popcount32(value)).toBe(bits);
  });
});

describe('@vp/domain: isLowEntropy', () => {
  it.each([
    { name: 'a zero band', value: 0, width: 16, low: true },
    { name: 'an all-ones band', value: 0xffff, width: 16, low: true },
    { name: 'a band with one set bit', value: 0x0100, width: 16, low: true },
    { name: 'a band with one clear bit', value: 0xfffb, width: 16, low: true },
    { name: 'a band with two set bits', value: 0x0101, width: 16, low: false },
    { name: 'a mixed band', value: 0x4567, width: 16, low: false },
    { name: 'a zero term', value: 0, width: 32, low: true },
    { name: 'an all-ones term', value: -1, width: 32, low: true },
    { name: 'a term with three set bits', value: 0b111, width: 32, low: true },
    { name: 'a term with three clear bits', value: ~0b111, width: 32, low: true },
    { name: 'a mixed term', value: 0x1234_5678, width: 32, low: false },
  ])('judges $name', ({ value, width, low }) => {
    expect(isLowEntropy(value, width, width === 16 ? 2 : 4)).toBe(low);
  });
});

describe('@vp/domain: isLowEntropyTerm', () => {
  it.each([
    { name: 'a zero term', term: 0, low: true },
    { name: 'an all-ones term', term: -1, low: true },
    { name: 'a mixed term', term: 0x1234_5678, low: false },
  ])('judges $name', ({ term, low }) => {
    expect(isLowEntropyTerm(term, 4)).toBe(low);
  });
});

describe('@vp/domain: lookupBands', () => {
  it('collects the distinct bands per position and leaves out the low-entropy ones', () => {
    const bands = lookupBands([0n, 0x0123_4567_89ab_cdefn, 0x0123_4567_89ab_cdefn, -1n], 2);

    expect(bands.map((set) => [...set])).toEqual([[0xcdef], [0x89ab], [0x4567], [0x0123]]);
  });

  it('is empty for no hashes', () => {
    expect(lookupBands([], 2).every((set) => set.size === 0)).toBe(true);
  });
});
