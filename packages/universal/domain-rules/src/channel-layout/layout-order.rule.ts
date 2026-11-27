function hashOf(text: string): number {
  let hash = 2166136261;
  for (const character of text) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619);
  }
  return hash >>> 0;
}

function generatorOf(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledBySeed<T>(items: readonly T[], seed: string): T[] {
  const next = generatorOf(hashOf(seed));
  const order = [...items];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    const held = order[index] as T;
    order[index] = order[swap] as T;
    order[swap] = held;
  }
  return order;
}
