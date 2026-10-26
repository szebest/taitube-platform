import { CHUNKED_TRANSCODE, chunkCountFor } from '../chunks';

describe('@vp/job-contracts: chunk plan', () => {
  it.each([
    { durationMs: 299_000, chunks: undefined },
    { durationMs: 300_000, chunks: undefined },
    { durationMs: 301_000, chunks: 11 },
    { durationMs: 360_000, chunks: 12 },
    { durationMs: 3_600_000, chunks: 120 },
  ])('plans $chunks chunks for $durationMs ms', ({ durationMs, chunks }) => {
    expect(chunkCountFor(durationMs)).toBe(chunks);
  });

  it('cuts on the two second keyframe grid', () => {
    expect(CHUNKED_TRANSCODE.chunkSeconds % 2).toBe(0);
  });
});
