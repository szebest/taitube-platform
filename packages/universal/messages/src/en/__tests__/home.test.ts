import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en home', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'home.continueWatching', expected: 'Continue watching' },
    { key: 'home.fromSubscriptions', expected: 'From your subscriptions' },
    { key: 'home.trending', expected: 'Trending now' },
    { key: 'home.empty', expected: 'Nothing to watch yet' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      name: 'Lisbon at night',
      key: 'home.becauseWatched',
      expected: 'Because you watched Lisbon at night',
    },
    { name: 'Music', key: 'home.popularIn', expected: 'Popular in Music' },
  ] as const)('puts $name into $key', ({ key, name, expected }) => {
    expect(t(key, { name })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { kind: 'continue', expected: 'Pick up where you left off' },
    { kind: 'subscription', expected: 'From a channel you follow' },
    { kind: 'co-watched', expected: 'Viewers also watched' },
    { kind: 'shared-tags', expected: 'Similar topics' },
    { kind: 'same-channel', expected: 'From the same channel' },
    { kind: 'same-category', expected: 'In the same category' },
    { kind: 'category', expected: 'Popular in this category' },
    { kind: 'trending', expected: 'Trending now' },
  ] as const)('words the $kind reason', ({ kind, expected }) => {
    expect(t('home.reason', { kind })).toEqual({ ok: true, value: expected });
  });
});
