export type NonEmpty<T> = readonly [T, ...T[]];

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both included. */
  int(min: number, max: number): number;
  pick<T>(items: NonEmpty<T>): T;
  chance(probability: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
}

/** FNV-1a, so a label and a seed give one stable 32-bit stream seed. */
export function deriveSeed(seed: number, label: string): number {
  let hash = 0x811c9dc5 ^ (seed >>> 0);
  for (const char of label) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast generator whose sequence is fixed by its seed. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = int(0, index);
      [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
    }
    return copy;
  };

  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)] ?? items[0],
    chance: (probability) => next() < probability,
    shuffle,
    sample: (items, count) => shuffle(items).slice(0, count),
  };
}
