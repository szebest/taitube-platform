import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl library', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'library.youTitle', args: undefined, expected: 'Ty' },
    { key: 'library.historyTitle', args: undefined, expected: 'Historia oglądania' },
    { key: 'library.unlike', args: undefined, expected: 'Cofnij polubienie' },
    { key: 'library.moveToTop', args: undefined, expected: 'Przenieś na początek' },
    { key: 'library.shelf', args: { shelf: 'watchLater' }, expected: 'Do obejrzenia' },
    { key: 'library.group', args: { group: 'thisWeek' }, expected: 'W tym tygodniu' },
    { key: 'library.clearTitle', args: { scope: 'searches' }, expected: 'Wyczyścić wyszukiwania?' },
    {
      key: 'library.savedTo',
      args: { title: 'Podróże' },
      expected: 'Zapisano na playliście Podróże',
    },
    { key: 'library.playlistCount', args: { count: 1 }, expected: '1 film' },
    { key: 'library.playlistCount', args: { count: 3 }, expected: '3 filmy' },
    { key: 'library.playlistCount', args: { count: 5 }, expected: '5 filmów' },
    {
      key: 'library.playlistDuration',
      args: { count: 22, duration: '1 godz.' },
      expected: '22 filmy, 1 godz.',
    },
    { key: 'library.episode', args: { number: 3 }, expected: 'Odcinek 3' },
    { key: 'library.continueSeries', args: undefined, expected: 'Kontynuuj' },
    { key: 'library.episodeWatched', args: { percent: 42 }, expected: 'Obejrzano 42%' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
