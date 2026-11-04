import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl library', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'library.youTitle', expected: 'Ty' },
    { key: 'library.historyTitle', expected: 'Historia oglądania' },
    { key: 'library.unlike', expected: 'Cofnij polubienie' },
    { key: 'library.moveToTop', expected: 'Przenieś na początek' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'library.shelf', args: { shelf: 'watchLater' }, expected: 'Do obejrzenia' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'library.group', args: { group: 'thisWeek' }, expected: 'W tym tygodniu' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'library.clearTitle', args: { scope: 'searches' }, expected: 'Wyczyścić wyszukiwania?' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'library.savedTo',
      args: { title: 'Podróże' },
      expected: 'Zapisano na playliście Podróże',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'library.playlistCount', args: { count: 1 }, expected: '1 film' },
    { key: 'library.playlistCount', args: { count: 3 }, expected: '3 filmy' },
    { key: 'library.playlistCount', args: { count: 5 }, expected: '5 filmów' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'library.playlistDuration',
      args: { count: 22, duration: '1 godz.' },
      expected: '22 filmy, 1 godz.',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
