import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl party', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'party.watchTogether', expected: 'Oglądaj razem' },
    { key: 'party.previewWatchAsGuest', expected: 'Oglądaj jako gość' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'party.rosterGuests', args: { count: 1 }, expected: '1 gość' },
    { key: 'party.rosterGuests', args: { count: 3 }, expected: '3 gości' },
    { key: 'party.roomPresent', args: { count: 3 }, expected: '3 osoby' },
    { key: 'party.roomPresent', args: { count: 5 }, expected: '5 osób' },
    { key: 'party.discoveryNewParties', args: { count: 3 }, expected: '3 nowe seanse' },
    { key: 'party.discoveryNewParties', args: { count: 5 }, expected: '5 nowych seansów' },
    {
      key: 'party.fullTitle',
      args: { present: 10, capacity: 10 },
      expected: 'Ten seans jest pełny (10 z 10)',
    },
  ] as const)('renders $key with $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
