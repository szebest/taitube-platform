import { fromClipTime, toClipPlayhead } from '../clip-playhead';

const range = { startMs: 10_000, endMs: 20_000 };

describe('apps/client/web: the clip playhead', () => {
  it.each([
    {
      scenario: 'no range',
      range: undefined,
      currentTime: 65,
      expected: { currentTime: 65, duration: 600 },
    },
    {
      scenario: 'inside the range',
      range,
      currentTime: 14,
      expected: { currentTime: 4, duration: 10 },
    },
    {
      scenario: 'before the range',
      range,
      currentTime: 9.8,
      expected: { currentTime: 0, duration: 10 },
    },
    {
      scenario: 'past the range',
      range,
      currentTime: 25,
      expected: { currentTime: 10, duration: 10 },
    },
    {
      scenario: 'a range running past the video',
      range: { startMs: 590_000, endMs: 700_000 },
      currentTime: 595,
      expected: { currentTime: 5, duration: 10 },
    },
    {
      scenario: 'a duration not loaded yet',
      range,
      currentTime: 0,
      duration: 0,
      expected: { currentTime: 0, duration: 10 },
    },
  ])('maps the time with $scenario', ({ range: clip, currentTime, duration = 600, expected }) => {
    expect(toClipPlayhead(clip, { currentTime, duration })).toEqual(expected);
  });

  it.each([
    { scenario: 'no range', range: undefined, clipTime: 30, expected: 30 },
    { scenario: 'inside the range', range, clipTime: 4, expected: 14 },
    { scenario: 'before the range', range, clipTime: -3, expected: 10 },
    { scenario: 'past the range', range, clipTime: 99, expected: 20 },
  ])('seeks into the video with $scenario', ({ range: clip, clipTime, expected }) => {
    expect(fromClipTime(clip, clipTime, 600)).toBe(expected);
  });
});
