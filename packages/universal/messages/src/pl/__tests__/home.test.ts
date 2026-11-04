import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl home', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'home.continueWatching', expected: 'Kontynuuj oglądanie' },
    { key: 'home.trending', expected: 'Na czasie' },
    { key: 'home.hideChannel', expected: 'Nie polecaj tego kanału' },
    { key: 'home.pickWatch', expected: 'Oglądaj' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'home.becauseSearched', args: { name: 'góry' }, expected: 'Bo szukasz: góry' },
    { key: 'home.popularIn', args: { name: 'Muzyka' }, expected: 'Popularne w: Muzyka' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'home.reason', args: { kind: 'same-channel' }, expected: 'Z tego samego kanału' },
    {
      key: 'home.reason',
      args: { kind: 'rising' },
      expected: 'Mały kanał, który widzowie oglądają do końca',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'home.pickWindow',
      args: { left: '3 godz.' },
      expected: 'Wybrane na dziś, zostało 3 godz.',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
