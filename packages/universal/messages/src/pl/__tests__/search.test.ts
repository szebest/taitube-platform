import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl search', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'search.viewChannel', args: undefined, expected: 'Zobacz kanał' },
    { key: 'search.noQuery', args: undefined, expected: 'Wpisz słowo, którego szukasz' },
    { key: 'search.openHistory', args: undefined, expected: 'Otwórz historię' },
    { key: 'search.resultsFor', args: { query: 'koty' }, expected: 'Wyniki dla: koty' },
    { key: 'search.type', args: { type: 'playlist' }, expected: 'Playlisty' },
    { key: 'search.switchMode', args: { mode: 'dark' }, expected: 'Przełącz na tryb ciemny' },
    { key: 'search.resultCount', args: { count: 1 }, expected: '1 wynik' },
    { key: 'search.resultCount', args: { count: 22 }, expected: '22 wyniki' },
    { key: 'search.resultCount', args: { count: 5 }, expected: '5 wyników' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
