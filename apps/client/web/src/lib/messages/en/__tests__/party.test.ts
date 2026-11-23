import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en party', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'party.watchTogether', expected: 'Watch together' },
    { key: 'party.previewWatchAsGuest', expected: 'Watch as guest' },
    { key: 'party.stageTapForSound', expected: 'Tap for sound' },
    { key: 'party.rosterSyncCatchingUp', expected: 'Catching up' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'party.memberOptions', args: { name: 'Ana' }, expected: 'Options for Ana' },
    {
      key: 'party.roomTitle',
      args: { name: 'Movie night' },
      expected: 'Movie night - watch party',
    },
    {
      key: 'party.fullTitle',
      args: { present: 10, capacity: 10 },
      expected: 'This party is full (10 of 10)',
    },
    { key: 'party.rosterReady', args: { ready: 4, total: 6 }, expected: '4 of 6 ready' },
    { key: 'party.rosterGuests', args: { count: 1 }, expected: '1 guest' },
    { key: 'party.rosterGuests', args: { count: 12 }, expected: '12 guests' },
    { key: 'party.discoveryNewParties', args: { count: 3 }, expected: '3 new parties' },
    {
      key: 'party.headDescription',
      args: { title: 'Bunny', count: 2 },
      expected: 'Watching Bunny with 2 people',
    },
  ] as const)('renders $key with $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
