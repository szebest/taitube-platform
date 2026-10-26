import { calculatePartSize, calculateTotalParts } from '../multipart';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const TIB = 1024 * GIB;
const BOUNDS = { minBytes: 8 * MIB, maxBytes: 64 * MIB };

describe('packages/storage: multipart sizing', () => {
  it.each([
    { size: 100_000_000, bounds: BOUNDS, expected: 8 * MIB },
    { size: GIB, bounds: BOUNDS, expected: 8 * MIB },
    { size: 4 * GIB, bounds: BOUNDS, expected: 32 * MIB },
    { size: 8 * GIB, bounds: BOUNDS, expected: 64 * MIB },
    { size: 64 * GIB, bounds: BOUNDS, expected: 64 * MIB },
    { size: GIB, bounds: { minBytes: MIB, maxBytes: 64 * MIB }, expected: 8 * MIB },
    { size: 100 * MIB, bounds: { minBytes: MIB, maxBytes: 64 * MIB }, expected: 5 * MIB },
    { size: TIB, bounds: BOUNDS, expected: 105 * MIB },
  ])('sizes $size bytes under $bounds as $expected', ({ size, bounds, expected }) => {
    expect(calculatePartSize(size, bounds)).toBe(expected);
  });

  it.each([100_000_000, GIB, 4 * GIB, 64 * GIB, TIB])(
    'keeps %s bytes inside the part ceiling',
    (size) => {
      expect(calculateTotalParts(size, calculatePartSize(size, BOUNDS))).toBeLessThanOrEqual(
        10_000
      );
    }
  );
});
