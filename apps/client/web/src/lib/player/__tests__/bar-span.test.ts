import { barPercent, barSpan } from '../bar-span';

describe('apps/client/web: barSpan', () => {
  it.each([
    {
      name: 'the whole video',
      range: undefined,
      duration: 600,
      span: { startMs: 0, endMs: 600_000 },
    },
    {
      name: 'a clip inside it',
      range: { startMs: 60_000, endMs: 90_000 },
      duration: 600,
      span: { startMs: 60_000, endMs: 90_000 },
    },
    {
      name: 'a clip cut short by the end',
      range: { startMs: 500_000, endMs: 900_000 },
      duration: 600,
      span: { startMs: 500_000, endMs: 600_000 },
    },
    { name: 'a video of unknown length', range: undefined, duration: 0, span: undefined },
    {
      name: 'a clip past the end',
      range: { startMs: 700_000, endMs: 800_000 },
      duration: 600,
      span: undefined,
    },
  ])('shows $name', ({ range, duration, span }) => {
    expect(barSpan(range, duration)).toEqual(span);
  });
});

describe('apps/client/web: barPercent', () => {
  const span = { startMs: 100_000, endMs: 200_000 };

  it.each([
    { atMs: 100_000, percent: 0 },
    { atMs: 150_000, percent: 50 },
    { atMs: 199_000, percent: 99 },
    { atMs: 99_999, percent: undefined },
    { atMs: 200_000, percent: undefined },
  ])('puts $atMs ms at $percent', ({ atMs, percent }) => {
    expect(barPercent(atMs, span)).toBe(percent);
  });
});
