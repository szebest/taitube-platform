import { type MarkerThread, placeThreadMarkers } from '../thread-markers.rule';

const DURATION = 100_000;

const thread = (id: string, anchorMs: number, over: Partial<MarkerThread> = {}): MarkerThread => ({
  id,
  anchorMs,
  pinned: false,
  replyCount: 2,
  repliers: 2,
  ...over,
});

describe('@vp/domain-rules: placeThreadMarkers', () => {
  it.each([
    { name: 'no threads', threads: [], expected: [] },
    {
      name: 'one reply',
      threads: [thread('a', 10_000, { replyCount: 1, repliers: 1 })],
      expected: [],
    },
    {
      name: 'two replies from one viewer',
      threads: [thread('a', 10_000, { replyCount: 2, repliers: 1 })],
      expected: [],
    },
    {
      name: 'two replies from two viewers',
      threads: [thread('a', 10_000)],
      expected: [{ anchorMs: 10_000, threadId: 'a', threadIds: ['a'], count: 1 }],
    },
    {
      name: 'a pin without replies',
      threads: [thread('a', 10_000, { pinned: true, replyCount: 0, repliers: 0 })],
      expected: [{ anchorMs: 10_000, threadId: 'a', threadIds: ['a'], count: 1 }],
    },
  ])('draws $name as $expected', ({ threads, expected }) => {
    expect(placeThreadMarkers(threads, DURATION)).toEqual(expected);
  });

  it.each([
    { name: 'exactly 1 percent apart', second: 11_000, markers: 1 },
    { name: 'just over 1 percent apart', second: 11_001, markers: 2 },
    { name: 'at the same moment', second: 10_000, markers: 1 },
  ])('draws threads $name as $markers marker(s)', ({ second, markers }) => {
    const placed = placeThreadMarkers([thread('a', 10_000), thread('b', second)], DURATION);

    expect(placed).toHaveLength(markers);
  });

  it('merges into the earliest anchor and opens the pinned thread, else the busiest', () => {
    const busiest = placeThreadMarkers(
      [thread('a', 10_000), thread('b', 10_400, { replyCount: 9 })],
      DURATION
    );
    const pinned = placeThreadMarkers(
      [
        thread('a', 10_000),
        thread('b', 10_400, { replyCount: 9 }),
        thread('c', 10_500, { pinned: true }),
      ],
      DURATION
    );

    expect(busiest).toEqual([{ anchorMs: 10_000, threadId: 'b', threadIds: ['a', 'b'], count: 2 }]);
    expect(pinned[0]).toMatchObject({ threadId: 'c', count: 3 });
  });

  it('chains no further than the first thread of a group can reach', () => {
    const placed = placeThreadMarkers(
      [thread('a', 10_000), thread('b', 10_900), thread('c', 11_800)],
      DURATION
    );

    expect(placed.map(({ threadIds }) => threadIds)).toEqual([['a', 'b'], ['c']]);
  });

  it('draws at most 20, keeping pins first and then the busiest, in order along the bar', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      thread(`t${index}`, index * 3_000, { replyCount: 2 + index, pinned: index === 0 })
    );

    const placed = placeThreadMarkers(many, DURATION);

    expect(placed).toHaveLength(20);
    expect(placed[0]?.threadId).toBe('t0');
    expect(placed.map(({ anchorMs }) => anchorMs)).toEqual(
      [...placed.map(({ anchorMs }) => anchorMs)].sort((a, b) => a - b)
    );
    expect(placed.some(({ threadId }) => threadId === 't1')).toBe(false);
  });

  it('draws nothing for a video with no duration', () => {
    expect(placeThreadMarkers([thread('a', 0)], 0)).toEqual([]);
  });
});
