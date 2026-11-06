import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl home', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'home.continueWatching', args: undefined, expected: 'Kontynuuj oglądanie' },
    { key: 'home.trending', args: undefined, expected: 'Na czasie' },
    { key: 'home.hideChannel', args: undefined, expected: 'Nie polecaj tego kanału' },
    { key: 'home.pickWatch', args: undefined, expected: 'Oglądaj' },
    { key: 'home.becauseSearched', args: { name: 'góry' }, expected: 'Bo szukasz: góry' },
    { key: 'home.popularIn', args: { name: 'Muzyka' }, expected: 'Popularne w: Muzyka' },
    { key: 'home.reason', args: { kind: 'same-channel' }, expected: 'Z tego samego kanału' },
    {
      key: 'home.reason',
      args: { kind: 'rising' },
      expected: 'Mały kanał, który widzowie oglądają do końca',
    },
    {
      key: 'home.pickWindow',
      args: { left: '3 godz.' },
      expected: 'Wybrane na dziś, zostało 3 godz.',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
