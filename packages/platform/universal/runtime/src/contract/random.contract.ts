import type { Random } from '../tokens';

export type MakeRandom = () => Random;

const DRAWS = 1_000;

export function describeRandomContract(makeRandom: MakeRandom): void {
  describe('Random contract', () => {
    it('draws numbers from zero up to, and never including, one', () => {
      const random = makeRandom();
      const draws = Array.from({ length: DRAWS }, () => random.next());

      expect(draws.every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)).toBe(true);
    });

    it('does not repeat one draw forever', () => {
      const random = makeRandom();
      const draws = new Set(Array.from({ length: DRAWS }, () => random.next()));

      expect(draws.size).toBeGreaterThan(1);
    });
  });
}
