import type { FrameFingerprintHit } from '@vp/core/repositories';
import type { FrameSample } from '../frame-hash';

const SPREAD = 0x9e37_79b9_7f4a_7c15n;

export const hashAt = (index: number, family = 0): bigint =>
  BigInt.asUintN(64, BigInt(index + 1 + family * 100_000) * SPREAD);

export const flip = (hash: bigint, bits: number[]): bigint =>
  bits.reduce((value, bit) => value ^ (1n << BigInt(bit)), hash);

export const sampleOf = (hash: bigint, mirroredHash = hashAt(0, 999)): FrameSample => ({
  hash,
  mirroredHash,
  luma: 100,
});

export const storedFrames = (videoId: string, hashes: bigint[]): FrameFingerprintHit[] =>
  hashes.map((hash, idx) => ({ videoId, idx, hash }));
