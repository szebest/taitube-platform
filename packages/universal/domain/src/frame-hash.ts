const BITS = 64;
const WORD_MASK = 0xffffffffn;
const BITS_PER_WORD = 32;

/** The number of set bits in the low 32 bits of `value`. */
export function popcount32(value: number): number {
  let rest = value >>> 0;
  let count = 0;
  while (rest !== 0) {
    rest &= rest - 1;
    count += 1;
  }
  return count;
}

/** The number of bits in which two 64-bit frame hashes differ. */
export function hammingDistance(a: bigint, b: bigint): number {
  const diff = BigInt.asUintN(BITS, a ^ b);
  return popcount32(Number(diff & WORD_MASK)) + popcount32(Number(diff >> BigInt(BITS_PER_WORD)));
}

const BAND_BITS = 16n;
const BAND_MASK = 0xffffn;
const BAND_BITS_COUNT = 16;

/**
 * The four 16-bit bands of a frame hash, low band first. A frame within Hamming distance 3 of another
 * agrees with it on at least one band exactly, since three flipped bits touch at most three of four.
 */
export function frameBands(hash: bigint): [number, number, number, number] {
  const bits = BigInt.asUintN(BITS, hash);
  return [0n, 1n, 2n, 3n].map((band) => Number((bits >> (band * BAND_BITS)) & BAND_MASK)) as [
    number,
    number,
    number,
    number,
  ];
}

/**
 * Whether a `width`-bit value is nearly all zeros or all ones: what a black or title-card frame
 * hashes to in every band, and what silence fingerprints to. Such a value matches thousands of
 * unrelated videos, so a lookup leaves it out.
 */
export function isLowEntropy(value: number, width: number, minSetBits: number): boolean {
  const set = popcount32(value);
  return set < minSetBits || width - set < minSetBits;
}

/** The distinct bands of `hashes` per position, without the low-entropy ones. */
export function lookupBands(hashes: readonly bigint[], minSetBits: number): Set<number>[] {
  const positions = Array.from({ length: 4 }, () => new Set<number>());
  for (const hash of hashes) {
    for (const [position, band] of frameBands(hash).entries()) {
      if (!isLowEntropy(band, BAND_BITS_COUNT, minSetBits)) positions[position]?.add(band);
    }
  }
  return positions;
}
