import type { Clock } from '../tokens';

export type MakeClock = () => Clock;

const READS = 50;

export function describeClockContract(makeClock: MakeClock): void {
  describe('Clock contract', () => {
    it('reads a finite number of milliseconds', () => {
      expect(Number.isFinite(makeClock().now())).toBe(true);
    });

    it('never reads an earlier instant than the one before', () => {
      const clock = makeClock();
      const reads = Array.from({ length: READS }, () => clock.now());

      expect(reads).toEqual([...reads].sort((a, b) => a - b));
    });
  });
}
