import { filterByTitle, groupByDay } from '../history-groups';
import { historyItem, NOW } from './library-fixtures';

describe('apps/client/web: history groups', () => {
  describe('groupByDay', () => {
    it.each([
      { watchedAt: '2026-03-10T00:00:01.000Z', group: 'today' },
      { watchedAt: '2026-03-09T23:59:59.000Z', group: 'yesterday' },
      { watchedAt: '2026-03-04T08:00:00.000Z', group: 'thisWeek' },
      { watchedAt: '2026-03-03T23:00:00.000Z', group: 'older' },
    ])('puts $watchedAt in $group', ({ watchedAt, group }) => {
      const groups = groupByDay([historyItem(1, { watchedAt })], NOW);

      expect(groups.map(({ id }) => id)).toEqual([group]);
    });

    it('calls everything older without a reference instant', () => {
      expect(groupByDay([historyItem(1)], undefined).map(({ id }) => id)).toEqual(['older']);
    });

    it('keeps the order of the items inside a group and leaves empty groups out', () => {
      const first = historyItem(1);
      const second = historyItem(2);
      const old = historyItem(3, { watchedAt: '2025-01-01T00:00:00.000Z' });

      expect(groupByDay([first, second, old], NOW)).toEqual([
        { id: 'today', items: [first, second] },
        { id: 'older', items: [old] },
      ]);
    });
  });

  describe('filterByTitle', () => {
    const items = [historyItem(1, { title: 'Lisbon at night' }), historyItem(2, { title: 'Tram' })];

    it.each([
      { words: '', titles: ['Lisbon at night', 'Tram'] },
      { words: '   ', titles: ['Lisbon at night', 'Tram'] },
      { words: 'LISBON', titles: ['Lisbon at night'] },
      { words: ' tram ', titles: ['Tram'] },
      { words: 'metro', titles: [] },
    ])('keeps $titles for "$words"', ({ words, titles }) => {
      expect(filterByTitle(items, words).map(({ video }) => video.title)).toEqual(titles);
    });
  });
});
