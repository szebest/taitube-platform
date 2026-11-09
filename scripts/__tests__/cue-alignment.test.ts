import { compareCues } from '../cue-alignment';

const utterances = [
  { startMs: 3000, endMs: 7000 },
  { startMs: 10_000, endMs: 14_000 },
  { startMs: 20_000, endMs: 24_000 },
];

describe('compareCues', () => {
  it('passes cues that start and end with speech, one per utterance or one across several, and reports the worst offsets', () => {
    const report = compareCues(
      utterances,
      [
        { startMs: 3040, endMs: 14_090 },
        { startMs: 19_920, endMs: 24_000 },
      ],
      100
    );

    expect(report).toEqual({
      cues: 2,
      utterances: 3,
      maxStartDeviationMs: 80,
      maxEndDeviationMs: 90,
      failures: [],
    });
  });

  it.each([
    {
      name: 'a start away from every speech onset',
      cues: [
        { startMs: 3500, endMs: 14_000 },
        { startMs: 20_000, endMs: 24_000 },
      ],
      failure: 'cue 0 starts at 3500 ms, 500 ms from the nearest speech start at 3000 ms',
    },
    {
      name: 'an end away from every speech offset',
      cues: [
        { startMs: 3000, endMs: 14_000 },
        { startMs: 20_000, endMs: 25_000 },
      ],
      failure: 'cue 1 ends at 25000 ms, 1000 ms from the nearest speech end at 24000 ms',
    },
    {
      name: 'an utterance no cue covers',
      cues: [
        { startMs: 3000, endMs: 7000 },
        { startMs: 20_000, endMs: 24_000 },
      ],
      failure: 'utterance 1 (10000-14000 ms) is not covered by a cue',
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
        { startMs: 20_000, endMs: 24_000 },
        { startMs: 3000, endMs: 14_000 },
      ],
      failure: 'cue 1 starts at 3000 ms, before cue 0 at 20000 ms',
    },
  ])('fails on $name', ({ cues, failure }) => {
    expect(compareCues(utterances, cues, 100).failures).toContain(failure);
  });
});
