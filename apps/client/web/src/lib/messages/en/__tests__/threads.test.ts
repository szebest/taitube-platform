import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en threads', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'threads.tab', args: { tab: 'threads' }, expected: 'Threads' },
    { key: 'threads.tab', args: { tab: 'comments' }, expected: 'Comments' },
    { key: 'threads.replyCount', args: { count: 1 }, expected: '1 reply' },
    { key: 'threads.replyCount', args: { count: 4 }, expected: '4 replies' },
    { key: 'threads.startAt', args: { time: '1:05' }, expected: 'Start a thread at 1:05' },
    { key: 'threads.anchorAt', args: { time: '0:30' }, expected: 'At 0:30' },
    { key: 'threads.counter', args: { count: 12, max: 100 }, expected: '12 / 100' },
    { key: 'threads.jumpTo', args: { time: '2:00' }, expected: 'Go to 2:00' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
