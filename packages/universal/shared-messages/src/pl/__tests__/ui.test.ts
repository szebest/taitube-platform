import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: pl ui', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'ui.close', expected: 'Zamknij' },
    { key: 'ui.modeSystem', expected: 'Systemowy' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'ui.reorder', args: { name: 'Muzyka' }, expected: 'Zmień kolejność: Muzyka' },
    {
      key: 'ui.pickedUp',
      args: { name: 'Muzyka', position: 2, count: 5 },
      expected: 'Podniesiono Muzyka, pozycja 2 z 5',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
