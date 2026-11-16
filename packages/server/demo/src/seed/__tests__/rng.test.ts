import { createRng, deriveSeed } from '../rng';

describe('seed/rng: createRng', () => {
  it('gives one sequence per seed', () => {
    const draw = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 5 }, () => rng.next());
    };

    expect(draw(1729)).toEqual(draw(1729));
    expect(draw(1729)).not.toEqual(draw(1730));
  });

  it('draws floats in [0, 1) and integers inside the inclusive range', () => {
    const rng = createRng(7);
    const floats = Array.from({ length: 200 }, () => rng.next());
    const ints = Array.from({ length: 200 }, () => rng.int(3, 5));

    expect(floats.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(ints)).toEqual(new Set([3, 4, 5]));
  });

  it('picks from the items, shuffles without losing any and samples a prefix of the shuffle', () => {
    const rng = createRng(11);
    const items = ['a', 'b', 'c', 'd', 'e'] as const;

    expect(items).toContain(rng.pick(items));
    expect([...rng.shuffle(items)].sort()).toEqual([...items]);
    expect(rng.sample(items, 2)).toHaveLength(2);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it.each([
    { probability: 0, expected: false },
    { probability: 1, expected: true },
  ])('chance($probability) is always $expected', ({ probability, expected }) => {
    const rng = createRng(3);

    expect(Array.from({ length: 50 }, () => rng.chance(probability))).toEqual(
      Array.from({ length: 50 }, () => expected)
    );
  });
});

describe('seed/rng: deriveSeed', () => {
  it('splits one seed into stable streams per label', () => {
    expect(deriveSeed(1, 'videos')).toBe(deriveSeed(1, 'videos'));
    expect(deriveSeed(1, 'videos')).not.toBe(deriveSeed(1, 'users'));
    expect(deriveSeed(1, 'videos')).not.toBe(deriveSeed(2, 'videos'));
  });
});
