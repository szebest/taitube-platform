import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en live', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'live.title', expected: 'Live' },
    { key: 'live.emptyTitle', expected: 'Nothing is live right now' },
    {
      key: 'live.emptyDescription',
      expected: 'When a channel goes live, its stream and chat will be here.',
    },
    { key: 'live.browse', expected: 'Browse videos' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'live.watching', args: { count: 1 }, expected: '1 watching' },
    { key: 'live.watching', args: { count: 1200 }, expected: '1.2K watching' },
    { key: 'live.chatSlowMode', args: { seconds: 1 }, expected: 'Slow mode: one message every second' },
    { key: 'live.chatSlowMode', args: { seconds: 30 }, expected: 'Slow mode: one message every 30 seconds' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
