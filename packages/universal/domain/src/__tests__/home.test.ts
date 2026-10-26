import type { WatchHistoryEntry } from '../watch-history';
import { isContinuable, isStrongWatch, topCategoryIds } from '../home';

const entry = (
  progressSeconds: number,
  status: WatchHistoryEntry['video']['status'] = 'READY'
): WatchHistoryEntry =>
  ({ progressSeconds, durationSeconds: 100, video: { status } }) as WatchHistoryEntry;

describe('@vp/domain: home shelves', () => {
  it.each([
    { scenario: 'a video just started', watched: entry(1), continuable: true, strong: false },
    { scenario: 'half way through', watched: entry(50), continuable: true, strong: true },
    { scenario: 'never played', watched: entry(0), continuable: false, strong: false },
    { scenario: 'watched to the end', watched: entry(95), continuable: false, strong: true },
    {
      scenario: 'no longer ready',
      watched: entry(60, 'DELETED'),
      continuable: false,
      strong: false,
    },
  ])(
    'reads $scenario as continuable $continuable and strong $strong',
    ({ watched, continuable, strong }) => {
      expect(isContinuable(watched)).toBe(continuable);
      expect(isStrongWatch(watched)).toBe(strong);
    }
  );

  it.each([
    { scenario: 'by how often', categories: ['b', 'a', 'b', 'c'], max: 2, expected: ['b', 'a'] },
    { scenario: 'first seen on a tie', categories: ['c', 'a', 'b'], max: 2, expected: ['c', 'a'] },
    {
      scenario: 'skipping videos without one',
      categories: [null, undefined, 'a'],
      max: 3,
      expected: ['a'],
    },
  ])('picks the top categories $scenario', ({ categories, max, expected }) => {
    expect(
      topCategoryIds(
        categories.map((categoryId) => ({ categoryId })),
        max
      )
    ).toEqual(expected);
  });
});
