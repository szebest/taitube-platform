import {
  CAPTIONS_CHUNKED,
  CHUNKED_TRANSCODE,
  captionsWindow,
  captionsWindowCountFor,
  chunkCountFor,
} from '../chunks';

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

describe('@vp/job-contracts: captions window plan', () => {
  it.each([
    { durationMs: 300_000, windows: undefined },
    { durationMs: 301_000, windows: 2 },
    { durationMs: 720_000, windows: 4 },
    { durationMs: 721_000, windows: 5 },
  ])('plans $windows windows for $durationMs ms', ({ durationMs, windows }) => {
    expect(captionsWindowCountFor(durationMs)).toBe(windows);
  });

  it('reads a lead-in and a tail around each window but owns only its own span', () => {
    const durationMs = 600_000;
    const count = captionsWindowCountFor(durationMs) ?? 0;
    const overlapMs = CAPTIONS_CHUNKED.overlapSeconds * 1000;

    expect(Array.from({ length: count }, (_, n) => captionsWindow(n, count, durationMs))).toEqual([
      { index: 0, startMs: 0, durationMs: 185_000, ownsFromMs: 0, ownsUntilMs: 180_000 },
      {
        index: 1,
        startMs: 180_000 - overlapMs,
        durationMs: 190_000,
        ownsFromMs: 180_000,
        ownsUntilMs: 360_000,
      },
      {
        index: 2,
        startMs: 355_000,
        durationMs: 190_000,
        ownsFromMs: 360_000,
        ownsUntilMs: 540_000,
      },
      {
        index: 3,
        startMs: 535_000,
        durationMs: 65_000,
        ownsFromMs: 540_000,
        ownsUntilMs: Number.POSITIVE_INFINITY,
      },
    ]);
  });
});
