import { FRAME_BYTES, FRAME_HEIGHT, FRAME_WIDTH } from './frame-sampling-args';

/** What one sampled frame contributes: its hash, the hash of its mirror image, and its mean brightness. */
export interface FrameSample {
  hash: bigint;
  mirroredHash: bigint;
  luma: number;
}

/**
 * Compares each pixel with its right neighbour, row by row, first comparison in the highest bit: a
 * set bit means the pixel is brighter than the one beside it.
 */
function dHash(pixels: Uint8Array): bigint {
  let hash = 0n;
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH - 1; x++) {
      const left = pixels[y * FRAME_WIDTH + x] ?? 0;
      const right = pixels[y * FRAME_WIDTH + x + 1] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

function mirrorFrame(pixels: Uint8Array): Uint8Array {
  const mirrored = new Uint8Array(FRAME_BYTES);
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      mirrored[y * FRAME_WIDTH + x] = pixels[y * FRAME_WIDTH + (FRAME_WIDTH - 1 - x)] ?? 0;
    }
  }
  return mirrored;
}

function meanLuma(pixels: Uint8Array): number {
  let sum = 0;
  for (const pixel of pixels) sum += pixel;
  return sum / pixels.length;
}

export function sampleFrame(pixels: Uint8Array): FrameSample {
  return {
    hash: dHash(pixels),
    mirroredHash: dHash(mirrorFrame(pixels)),
    luma: meanLuma(pixels),
  };
}

/** Cuts the raw stream into frames; a trailing partial frame, from a killed run, is dropped. */
export function splitFrames(bytes: Uint8Array): Uint8Array[] {
  const frames: Uint8Array[] = [];
  for (let start = 0; start + FRAME_BYTES <= bytes.length; start += FRAME_BYTES) {
    frames.push(bytes.subarray(start, start + FRAME_BYTES));
  }
  return frames;
}
