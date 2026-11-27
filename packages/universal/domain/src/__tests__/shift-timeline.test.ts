import { shiftTimeline } from '../shift-timeline';
import type { GenerationTimeline } from '../video-generations';

const chapter = (startMs: number) => ({ startMs, title: `at ${startMs}` });
const correction = (startMs: number, endMs: number) => ({ startMs, endMs, text: 'fix' });

const timeline: GenerationTimeline = {
  chapters: [0, 60_000, 120_000, 180_000, 240_000].map(chapter),
  corrections: [correction(10_000, 20_000), correction(118_000, 125_000)],
};

describe('@vp/domain: shiftTimeline', () => {
  it('leaves the timeline alone without a trim', () => {
    expect(shiftTimeline(timeline, null)).toBe(timeline);
  });

  it.each([
    {
      shape: 'a trim of the head opens with the chapter it starts in, at zero',
      trim: { startMs: 30_000, endMs: 300_000 },
      starts: [0, 30_000, 90_000, 150_000, 210_000],
    },
    {
      shape: 'a trim of the tail cuts the chapters past its end',
      trim: { startMs: 0, endMs: 200_000 },
      starts: [0, 60_000, 120_000, 180_000],
    },
    {
      shape: 'a chapter pushed inside the gap of the one before is dropped',
      trim: { startMs: 115_000, endMs: 300_000 },
      starts: [0, 65_000, 125_000],
    },
    {
      shape: 'fewer chapters than the rule allows are all dropped',
      trim: { startMs: 150_000, endMs: 230_000 },
      starts: [],
    },
  ])('chapters: $shape', ({ trim, starts }) => {
    expect(shiftTimeline(timeline, trim).chapters.map(({ startMs }) => startMs)).toEqual(starts);
  });

  it.each([
    {
      shape: 'a correction inside the trim moves with it',
      trim: { startMs: 5_000, endMs: 300_000 },
      ranges: [
        [5_000, 15_000],
        [113_000, 120_000],
      ],
    },
    {
      shape: 'a correction the trim cuts keeps the part inside',
      trim: { startMs: 0, endMs: 122_000 },
      ranges: [
        [10_000, 20_000],
        [118_000, 122_000],
      ],
    },
    {
      shape: 'a correction left shorter than two seconds is dropped',
      trim: { startMs: 19_000, endMs: 119_000 },
      ranges: [],
    },
  ])('corrections: $shape', ({ trim, ranges }) => {
    expect(
      shiftTimeline(timeline, trim).corrections.map(({ startMs, endMs }) => [startMs, endMs])
    ).toEqual(ranges);
  });
});
