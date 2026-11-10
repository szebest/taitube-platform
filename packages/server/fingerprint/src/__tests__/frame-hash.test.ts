import { sampleFrame, splitFrames } from '../frame-hash';
import { FRAME_BYTES } from '../frame-sampling-args';

const gradient = (direction: 1 | -1): Uint8Array =>
  Uint8Array.from({ length: FRAME_BYTES }, (_, i) => {
    const x = i % 9;
    return direction === 1 ? x * 20 : (8 - x) * 20;
  });

describe('@vp/fingerprint: sampleFrame hash', () => {
  it.each([
    { name: 'a flat frame', pixels: new Uint8Array(FRAME_BYTES).fill(90), hash: 0n },
    { name: 'a frame darkening to the right', pixels: gradient(-1), hash: (1n << 64n) - 1n },
    { name: 'a frame brightening to the right', pixels: gradient(1), hash: 0n },
  ])('hashes $name', ({ pixels, hash }) => {
    expect(sampleFrame(pixels).hash).toBe(hash);
  });

  it('sets the highest bit for the first comparison and the lowest for the last', () => {
    const first = new Uint8Array(FRAME_BYTES);
    first[0] = 255;
    const last = new Uint8Array(FRAME_BYTES);
    last[7 * 9 + 7] = 255;

    expect(sampleFrame(first).hash).toBe(1n << 63n);
    expect(sampleFrame(last).hash).toBe(1n);
  });

  it('ignores a uniform brightness shift', () => {
    const pixels = Uint8Array.from({ length: FRAME_BYTES }, (_, i) => (i * 37) % 100);
    const brighter = pixels.map((pixel) => pixel + 100);

    expect(sampleFrame(brighter).hash).toBe(sampleFrame(pixels).hash);
  });
});

describe('@vp/fingerprint: sampleFrame mirror', () => {
  it('hashes the frame with every row reversed', () => {
    expect(sampleFrame(gradient(1)).mirroredHash).toBe(sampleFrame(gradient(-1)).hash);
  });
});

describe('@vp/fingerprint: sampleFrame luma', () => {
  it.each([
    { name: 'black', pixels: new Uint8Array(FRAME_BYTES), luma: 0 },
    { name: 'white', pixels: new Uint8Array(FRAME_BYTES).fill(255), luma: 255 },
    {
      name: 'half and half',
      pixels: Uint8Array.from({ length: 4 }, (_, i) => (i % 2) * 100),
      luma: 50,
    },
  ])('averages $name', ({ pixels, luma }) => {
    expect(sampleFrame(pixels).luma).toBe(luma);
  });
});

describe('@vp/fingerprint: sampleFrame', () => {
  it('hashes the frame and its mirror image, so a flipped copy is found by the second', () => {
    const pixels = gradient(-1);
    const flipped = sampleFrame(gradient(1));
    const original = sampleFrame(pixels);

    expect(flipped.mirroredHash).toBe(original.hash);
    expect(original.mirroredHash).toBe(flipped.hash);
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
