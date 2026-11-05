import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl shorts', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'shorts.title', expected: 'Shorts' },
    { key: 'shorts.emptyTitle', expected: 'Tutaj pojawią się filmy Shorts' },
    { key: 'shorts.browse', expected: 'Przeglądaj filmy' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'shorts.announce',
      args: { title: 'Wiosna', channel: 'Lasy' },
      expected: 'Wiosna, autor: Lasy',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
