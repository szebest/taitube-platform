import { frameBands, hammingDistance } from '../frame-hash';

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
