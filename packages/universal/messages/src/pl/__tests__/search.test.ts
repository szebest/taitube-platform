import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl search', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'search.viewChannel', expected: 'Zobacz kanał' },
    { key: 'search.noQuery', expected: 'Wpisz słowo, którego szukasz' },
    { key: 'search.openHistory', expected: 'Otwórz historię' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'search.resultsFor', args: { query: 'koty' }, expected: 'Wyniki dla: koty' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([{ key: 'search.type', args: { type: 'playlist' }, expected: 'Playlisty' }] as const)(
    'renders $key for $args',
    ({ key, args, expected }) => {
      expect(t(key, args)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
    { key: 'search.switchMode', args: { mode: 'dark' }, expected: 'Przełącz na tryb ciemny' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'search.resultCount', args: { count: 1 }, expected: '1 wynik' },
    { key: 'search.resultCount', args: { count: 22 }, expected: '22 wyniki' },
    { key: 'search.resultCount', args: { count: 5 }, expected: '5 wyników' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
