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
});
