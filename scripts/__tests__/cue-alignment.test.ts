import { compareCues, describeAlignment } from '../cue-alignment';

const utterances = [
  { startMs: 3000, endMs: 7000 },
  { startMs: 10_000, endMs: 14_000 },
  { startMs: 20_000, endMs: 24_000 },
];

describe('compareCues', () => {
  it('passes a track whose first start and last end sit on the speech, and reports per-cue deviations without failing them', () => {
    const report = compareCues(
      utterances,
      [
        { startMs: 3040, endMs: 9000 },
        { startMs: 12_000, endMs: 24_050 },
      ],
      100
    );

    expect(report).toEqual({
      cues: 2,
      utterances: 3,
      startOffsetMs: 40,
      endOffsetMs: 50,
      driftMs: 10,
      maxStartDeviationMs: 2000,
      maxEndDeviationMs: 2000,
      failures: [],
    });
  });

  it.each([
    {
      name: 'a first cue start off the first speech start',
      cues: [
        { startMs: 3500, endMs: 14_000 },
        { startMs: 20_000, endMs: 24_000 },
      ],
      failure: 'the first cue starts at 3500 ms, 500 ms from the first speech start at 3000 ms',
    },
    {
      name: 'a last cue end off the last speech end',
      cues: [
        { startMs: 3000, endMs: 14_000 },
        { startMs: 20_000, endMs: 25_000 },
      ],
      failure: 'the last cue ends at 25000 ms, 1000 ms from the last speech end at 24000 ms',
    },
    {
      name: 'an offset that drifts although both ends are within tolerance',
      cues: [
        { startMs: 2920, endMs: 14_000 },
        { startMs: 20_000, endMs: 24_090 },
      ],
      failure:
        'the offset drifts by 170 ms across the file, from -80 ms at the start to 90 ms at the end',
    },
    {
      name: 'a cue over silence',
      cues: [
        { startMs: 3000, endMs: 14_000 },
        { startMs: 16_000, endMs: 17_000 },
        { startMs: 20_000, endMs: 24_000 },
      ],
      failure: 'cue 1 (16000-17000 ms) overlaps no utterance',
    },
    {
      name: 'cues out of order',
      cues: [
        { startMs: 3000, endMs: 14_000 },
        { startMs: 20_000, endMs: 24_000 },
        { startMs: 10_000, endMs: 14_000 },
      ],
      failure: 'cue 2 starts at 10000 ms, before cue 1 at 20000 ms',
    },
    {
      name: 'no cues',
      cues: [],
      failure: 'there are no cues or no speech spans to compare',
    },
  ])('fails on $name', ({ cues, failure }) => {
    expect(compareCues(utterances, cues, 100).failures).toContain(failure);
  });
});

describe('describeAlignment', () => {
  it('prints the offsets, the drift and the per-cue deviations as information', () => {
    const report = compareCues(utterances, [{ startMs: 3020, endMs: 24_038 }], 100);

    expect(describeAlignment(report, 100)).toBe(
      '1 cues over 3 utterances, first cue start 20 ms off, last cue end 38 ms off, drift 18 ms (tolerance 100 ms); per-cue edges up to 20 ms (start) and 38 ms (end) off, information only'
    );
  });
});
