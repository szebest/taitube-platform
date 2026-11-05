import { dt } from '../define';

export const search = {
  resultsFor: dt('Wyniki dla: {query}'),
  noResults: dt('Brak wyników dla: {query}'),
  topicsLabel: dt('Proponowane tematy'),
  viewChannel: dt('Zobacz kanał'),
  noResultsHint: dt('Sprawdź pisownię albo zacznij od jednego z tych tematów.'),
  noQuery: dt('Wpisz słowo, którego szukasz'),
  searchFor: dt('Szukaj: {query}'),
  fuzzyTitle: dt('Brak dokładnych wyników dla: {query}'),
  fuzzyBody: dt('Oto najbardziej zbliżone wyniki.'),
  filterLabel: dt('Typ wyniku'),
  type: dt('{type:enum}', {
    enum: { type: { all: 'Wszystko', video: 'Filmy', channel: 'Kanały', playlist: 'Playlisty' } },
  }),
  sortLabel: dt('Sortuj według'),
  sort: dt('{sort:enum}', {
    enum: { sort: { relevance: 'Trafność', date: 'Data przesłania', views: 'Liczba wyświetleń' } },
  }),
  playlistVideos: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film',
        few: '{?} filmy',
        many: '{?} filmów',
        other: '{?} filmu',
        formatter: { notation: 'compact' },
      },
    },
  }),
  group: dt('{kind:enum}', {
    enum: {
      kind: {
        video: 'Filmy',
        channel: 'Kanały',
        playlist: 'Playlisty',
        query: 'Sugestie',
        recent: 'Ostatnie wyszukiwania',
        action: 'Działania',
      },
    },
  }),
  removeRecent: dt('Usuń {query} z ostatnich wyszukiwań'),
  suggestionsFailed: dt('Nie udało się wczytać sugestii.'),
  resultCount: dt('{count:plural}', {
    plural: {
      count: { one: '{?} wynik', few: '{?} wyniki', many: '{?} wyników', other: '{?} wyniku' },
    },
  }),
  switchTheme: dt('Przełącz na motyw {name}'),
  switchMode: dt('Przełącz na {mode:enum}', {
    enum: {
      mode: {
        system: 'tryb systemowy',
        dark: 'tryb ciemny',
        light: 'tryb jasny',
        oled: 'tryb OLED',
      },
    },
  }),
  openHistory: dt('Otwórz historię'),
  uploadVideo: dt('Prześlij film'),
  actionKind: dt('{kind:enum}', {
    enum: { kind: { theme: 'motyw', mode: 'tryb', page: 'strona' } },
  }),
} as const;
