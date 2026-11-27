import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl threads', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'threads.tab', args: { tab: 'threads' }, expected: 'Wątki' },
    { key: 'threads.replyCount', args: { count: 1 }, expected: '1 odpowiedź' },
    { key: 'threads.replyCount', args: { count: 3 }, expected: '3 odpowiedzi' },
    { key: 'threads.replyCount', args: { count: 5 }, expected: '5 odpowiedzi' },
    { key: 'threads.startAt', args: { time: '1:05' }, expected: 'Zacznij wątek w 1:05' },
    { key: 'threads.counter', args: { count: 12, max: 100 }, expected: '12 / 100' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
