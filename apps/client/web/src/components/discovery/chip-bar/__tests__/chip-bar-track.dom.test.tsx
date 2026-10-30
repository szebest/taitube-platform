import { isRtl, readOverflow, revealInTrack, scrollByChevron } from '../chip-bar-track';

const makeTrack = (
  metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number },
  dir?: string
) => {
  const host = document.createElement('div');
  if (dir !== undefined) host.setAttribute('dir', dir);
  const track = document.createElement('div');
  host.append(track);
  Object.defineProperties(track, {
    scrollLeft: { value: metrics.scrollLeft },
    scrollWidth: { value: metrics.scrollWidth },
    clientWidth: { value: metrics.clientWidth },
  });
  track.scrollBy = vi.fn();
  return track;
};

const rect = (left: number, right: number) => ({ left, right }) as DOMRect;

describe('apps/client/web: chip-bar.track', () => {
  it.each([
    {
      name: 'at rest',
      metrics: { scrollLeft: 0, scrollWidth: 300, clientWidth: 100 },
      expected: { start: false, end: true },
    },
    {
      name: 'in the middle',
      metrics: { scrollLeft: 50, scrollWidth: 300, clientWidth: 100 },
      expected: { start: true, end: true },
    },
    {
      name: 'at the end (RTL travel is negative)',
      metrics: { scrollLeft: -200, scrollWidth: 300, clientWidth: 100 },
      expected: { start: true, end: false },
    },
    {
      name: 'with no overflow',
      metrics: { scrollLeft: 0, scrollWidth: 100, clientWidth: 100 },
      expected: { start: false, end: false },
    },
  ])('reads overflow $name', ({ metrics, expected }) => {
    expect(readOverflow(makeTrack(metrics))).toEqual(expected);
  });

  it.each([
    { dir: 'rtl', expected: true },
    { dir: 'ltr', expected: false },
    { dir: undefined, expected: false },
  ])('isRtl is $expected for dir $dir', ({ dir, expected }) => {
    expect(isRtl(makeTrack({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 }, dir))).toBe(expected);
  });

  it.each([
    { name: 'before the track', item: rect(-20, 30), expected: -20 },
    { name: 'after the track', item: rect(80, 130), expected: 30 },
    { name: 'inside the track', item: rect(10, 60), expected: undefined },
  ])('reveals an item $name', ({ item, expected }) => {
    const track = makeTrack({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
    track.getBoundingClientRect = () => rect(0, 100);
    const element = document.createElement('div');
    element.getBoundingClientRect = () => item;

    revealInTrack(track, element);

    if (expected === undefined) {
      expect(track.scrollBy).not.toHaveBeenCalled();
    } else {
      expect(track.scrollBy).toHaveBeenCalledWith({ left: expected });
    }
  });

  it.each([
    { dir: undefined, direction: 1 as const, expected: 60 },
    { dir: 'rtl', direction: 1 as const, expected: -60 },
    { dir: undefined, direction: -1 as const, expected: -60 },
  ])(
    'scrolls 60% of the width for dir $dir, direction $direction',
    ({ dir, direction, expected }) => {
      const track = makeTrack({ scrollLeft: 0, scrollWidth: 300, clientWidth: 100 }, dir);

      scrollByChevron(track, direction);

      expect(track.scrollBy).toHaveBeenCalledWith({ left: expected });
    }
  );

  it('ignores a missing track', () => {
    expect(() => scrollByChevron(null, 1)).not.toThrow();
  });
});
