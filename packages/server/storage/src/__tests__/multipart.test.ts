import { calculatePartSize, calculateTotalParts } from '../multipart';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const BOUNDS = { minBytes: 8 * MIB, maxBytes: 64 * MIB };

describe('packages/storage: multipart sizing', () => {
  it.each([
    { size: 150 * MIB, expected: BOUNDS.minBytes },
    { size: 4 * GIB, expected: BOUNDS.minBytes },
    { size: 20 * GIB, expected: Math.ceil((20 * GIB) / 1000) },
    { size: 100 * GIB, expected: BOUNDS.maxBytes },
  ])('clamps a thousandth of $size bytes to the bounds', ({ size, expected }) => {
    expect(calculatePartSize(size, BOUNDS)).toBe(expected);
  });

  it('keeps a 4 GB upload inside the 10 000 part ceiling', () => {
    expect(calculateTotalParts(4 * GIB, calculatePartSize(4 * GIB, BOUNDS))).toBe(512);
  });
});
