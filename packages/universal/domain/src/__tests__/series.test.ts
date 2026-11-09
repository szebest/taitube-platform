import { type EpisodeProgress, nextEpisode, percentWatched } from '../series';

const at = (day: number) => new Date(2026, 0, day);
const ep = (videoId: string, percent: number | null, day?: number): EpisodeProgress => ({
  videoId,
  percent,
  watchedAt: day === undefined ? null : at(day),
});

describe('@vp/domain: series', () => {
  it.each([
    {
      scenario: 'nothing watched: the first',
      episodes: [ep('a', null), ep('b', null)],
      expected: 'a',
    },
    {
      scenario: 'the last watched is unfinished: itself is not after, so the next one',
      episodes: [ep('a', 100, 1), ep('b', 40, 2), ep('c', null)],
      expected: 'c',
    },
    {
      scenario: 'the one after the last watched is finished: the next unfinished',
      episodes: [ep('a', 100, 1), ep('b', 92, 2), ep('c', 95, 3), ep('d', 10, 1)],
      expected: 'd',
    },
    {
      scenario: 'only earlier episodes unfinished: the first unfinished anywhere',
      episodes: [ep('a', 10, 1), ep('b', 100, 2), ep('c', 100, 3)],
      expected: 'a',
    },
    {
      scenario: 'everything finished',
      episodes: [ep('a', 100, 1), ep('b', 93, 2)],
      expected: null,
    },
    {
      scenario: 'a just-below-threshold episode counts as unfinished',
      episodes: [ep('a', 100, 1), ep('b', 91.9)],
      expected: 'b',
    },
    { scenario: 'an empty series', episodes: [], expected: null },
  ])('continues with $expected when $scenario', ({ episodes, expected }) => {
    expect(nextEpisode(episodes)).toBe(expected);
  });

  it.each([
    [30, 60_000, 50],
    [90, 60_000, 100],
    [0, 60_000, 0],
    [10, undefined, null],
    [10, 0, null],
  ])('reads %d s of %s ms as %s percent', (seconds, durationMs, expected) => {
    expect(percentWatched(seconds, durationMs)).toBe(expected);
  });
});
