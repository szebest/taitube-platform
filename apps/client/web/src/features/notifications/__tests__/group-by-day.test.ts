import { groupByDay } from '../group-by-day';
import { notification } from './notification-fixtures';

const NOW = '2026-03-10T12:00:00.000Z';
const dayOf = (instant: string) => instant.slice(0, 10);

const at = (id: string, createdAt: string) =>
  notification({ id: `0190c3a0-5e1d-7000-8000-0000000000${id}`, createdAt });

describe('apps/client/web: groupByDay', () => {
  it('folds a newest-first list into today, yesterday and each earlier day, in order', () => {
    const items = [
      at('a1', '2026-03-10T11:00:00.000Z'),
      at('a2', '2026-03-10T01:00:00.000Z'),
      at('a3', '2026-03-09T23:00:00.000Z'),
      at('a4', '2026-03-02T08:00:00.000Z'),
    ];

    const days = groupByDay(items, dayOf, NOW);

    expect(days.map(({ day, when, items: grouped }) => [day, when, grouped.length])).toEqual([
      ['2026-03-10', 'today', 2],
      ['2026-03-09', 'yesterday', 1],
      ['2026-03-02', 'earlier', 1],
    ]);
  });
});
