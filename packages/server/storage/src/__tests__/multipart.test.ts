import {
  MULTIPART_MAX_PART_SIZE,
  MULTIPART_MIN_PART_SIZE,
  calculatePartSize,
  calculateTotalParts,
} from '../multipart';

const GIB = 1024 * 1024 * 1024;

describe('packages/storage: multipart sizing', () => {
  it('clamps ceil(size/1000) between 8 MiB and 64 MiB', () => {
    expect(calculatePartSize(150 * 1024 * 1024)).toBe(MULTIPART_MIN_PART_SIZE);
    expect(calculatePartSize(4 * GIB)).toBe(MULTIPART_MIN_PART_SIZE);
    expect(calculatePartSize(20 * GIB)).toBe(Math.ceil((20 * GIB) / 1000));
    expect(calculatePartSize(100 * GIB)).toBe(MULTIPART_MAX_PART_SIZE);
  });

  it('keeps a 4 GB upload inside the 10 000 part ceiling', () => {
    expect(calculateTotalParts(4 * GIB, calculatePartSize(4 * GIB))).toBe(512);
  });
});
