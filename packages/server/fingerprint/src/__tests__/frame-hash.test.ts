import { dHash, meanLuma, mirrorFrame, sampleFrame, splitFrames } from '../frame-hash';
import { FRAME_BYTES } from '../frame-sampling-args';

const gradient = (direction: 1 | -1): Uint8Array =>
  Uint8Array.from({ length: FRAME_BYTES }, (_, i) => {
    const x = i % 9;
    return direction === 1 ? x * 20 : (8 - x) * 20;
  });

describe('@vp/fingerprint: dHash', () => {
  it.each([
    { name: 'a flat frame', pixels: new Uint8Array(FRAME_BYTES).fill(90), hash: 0n },
    { name: 'a frame darkening to the right', pixels: gradient(-1), hash: (1n << 64n) - 1n },
    { name: 'a frame brightening to the right', pixels: gradient(1), hash: 0n },
  ])('hashes $name', ({ pixels, hash }) => {
    expect(dHash(pixels)).toBe(hash);
  });

  it('sets the highest bit for the first comparison and the lowest for the last', () => {
    const first = new Uint8Array(FRAME_BYTES);
    first[0] = 255;
    const last = new Uint8Array(FRAME_BYTES);
    last[7 * 9 + 7] = 255;

    expect(dHash(first)).toBe(1n << 63n);
    expect(dHash(last)).toBe(1n);
  });

  it('ignores a uniform brightness shift', () => {
    const pixels = Uint8Array.from({ length: FRAME_BYTES }, (_, i) => (i * 37) % 100);
    const brighter = pixels.map((pixel) => pixel + 100);

    expect(dHash(brighter)).toBe(dHash(pixels));
  });
});

describe('@vp/fingerprint: mirrorFrame', () => {
  it('reverses every row', () => {
    const pixels = Uint8Array.from({ length: FRAME_BYTES }, (_, i) => i);

    const mirrored = mirrorFrame(pixels);

    expect([...mirrored.slice(0, 9)]).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect([...mirrored.slice(63, 72)]).toEqual([71, 70, 69, 68, 67, 66, 65, 64, 63]);
  });

  it('is its own inverse', () => {
    const pixels = Uint8Array.from({ length: FRAME_BYTES }, (_, i) => (i * 7) % 256);

    expect(mirrorFrame(mirrorFrame(pixels))).toEqual(pixels);
  });
});

describe('@vp/fingerprint: meanLuma', () => {
  it.each([
    { name: 'black', pixels: new Uint8Array(FRAME_BYTES), luma: 0 },
    { name: 'white', pixels: new Uint8Array(FRAME_BYTES).fill(255), luma: 255 },
    {
      name: 'half and half',
      pixels: Uint8Array.from({ length: 4 }, (_, i) => (i % 2) * 100),
      luma: 50,
    },
  ])('averages $name', ({ pixels, luma }) => {
    expect(meanLuma(pixels)).toBe(luma);
  });
});

describe('@vp/fingerprint: sampleFrame', () => {
  it('hashes the frame and its mirror image, so a flipped copy is found by the second', () => {
    const pixels = gradient(-1);
    const flipped = sampleFrame(mirrorFrame(pixels));
    const original = sampleFrame(pixels);

    expect(flipped.mirroredHash).toBe(original.hash);
    expect(original.mirroredHash).toBe(flipped.hash);
    expect(original.luma).toBe(meanLuma(pixels));
  });
});

describe('@vp/fingerprint: splitFrames', () => {
  it.each([
    { name: 'no bytes', length: 0, frames: 0 },
    { name: 'one frame', length: FRAME_BYTES, frames: 1 },
    { name: 'three frames', length: FRAME_BYTES * 3, frames: 3 },
    { name: 'three frames and a cut-off fourth', length: FRAME_BYTES * 3 + 30, frames: 3 },
  ])('cuts $name into $frames', ({ length, frames }) => {
    const cut = splitFrames(new Uint8Array(length));

    expect(cut).toHaveLength(frames);
    expect(cut.every((frame) => frame.length === FRAME_BYTES)).toBe(true);
  });

  it('keeps each frame its own bytes', () => {
    const bytes = Uint8Array.from({ length: FRAME_BYTES * 2 }, (_, i) => (i < FRAME_BYTES ? 1 : 2));

    expect(splitFrames(bytes).map((frame) => frame[0])).toEqual([1, 2]);
  });
});
