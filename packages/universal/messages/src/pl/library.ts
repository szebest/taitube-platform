import { dt } from '../define';

export const library = {
  youTitle: dt('Ty'),
  historyTitle: dt('Historia oglądania'),
  shelf: dt('{shelf:enum}', {
    enum: {
      shelf: {
        history: 'Historia',
        watchLater: 'Do obejrzenia',
        playlists: 'Playlisty',
        videos: 'Twoje filmy',
      },
    },
  }),
  shelfEmpty: dt('{shelf:enum}', {
    enum: {
      shelf: {
        history: 'Tutaj pojawią się obejrzane filmy',
        watchLater: 'Tutaj pojawią się filmy zapisane na później',
        playlists: 'Tutaj pojawią się utworzone przez Ciebie playlisty',
        videos: 'Tutaj pojawią się przesłane przez Ciebie filmy',
      },
    },
  }),
  playlistCount: dt('{count:plural}', {
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
  browse: dt('Przeglądaj filmy'),
  upload: dt('Prześlij film'),
  tabsLabel: dt('Twoja aktywność'),
  tab: dt('{tab:enum}', {
    enum: {
      tab: {
        history: 'Historia oglądania',
        searches: 'Wyszukiwania',
        liked: 'Polubione',
        comments: 'Komentarze',
      },
    },
  }),
  group: dt('{group:enum}', {
    enum: {
      group: {
        today: 'Dzisiaj',
        yesterday: 'Wczoraj',
        thisWeek: 'W tym tygodniu',
        older: 'Starsze',
      },
    },
  }),
  filterLabel: dt('Filtruj historię oglądania'),
  filterPlaceholder: dt('Przeszukaj historię oglądania'),
  clear: dt('{scope:enum}', {
    enum: {
      scope: {
        history: 'Wyczyść całą historię oglądania',
        searches: 'Wyczyść wszystkie wyszukiwania',
      },
    },
  }),
  clearTitle: dt('{scope:enum}', {
    enum: {
      scope: {
        history: 'Wyczyścić historię oglądania?',
        searches: 'Wyczyścić wyszukiwania?',
      },
    },
  }),
  clearBody: dt('{scope:enum}', {
    enum: {
      scope: {
        history:
          'Wszystkie filmy znikną z historii, a żaden nie będzie wznawiany od miejsca, w którym go przerwano.',
        searches: 'Wszystkie wyszukiwania znikną z historii.',
      },
    },
  }),
  removeFromHistory: dt('Usuń z historii oglądania'),
  removeSearch: dt('Usuń wyszukiwanie {query}'),
  unlike: dt('Cofnij polubienie'),
  deleteComment: dt('Usuń komentarz'),
  commentOn: dt('Pod filmem {title}'),
  empty: dt('{tab:enum}', {
    enum: {
      tab: {
        history: 'Nic jeszcze nie obejrzano',
        searches: 'Brak wyszukiwań',
        liked: 'Brak polubionych filmów',
        comments: 'Brak komentarzy',
      },
    },
  }),
  noMatches: dt('Nic w historii nie pasuje do: {query}'),
  changeFailed: dt('Nie udało się zapisać tej zmiany'),
  saveTitle: dt('Zapisz na playliście'),
  saveBody: dt('Wybierz playlisty, do których należy ten film.'),
  saveLoadFailed: dt('Nie udało się wczytać Twoich playlist'),
  saveSignIn: dt('Zaloguj się, aby zapisywać filmy na playlistach'),
  savedTo: dt('Zapisano na playliście {title}'),
  removedFrom: dt('Usunięto z playlisty {title}'),
  newPlaylist: dt('Nowa playlista'),
  playlistCreated: dt('Utworzono playlistę {title}'),
  newPlaylistBody: dt('Nadaj jej nazwę i wybierz, kto może ją zobaczyć.'),
  playlistTitleLabel: dt('Tytuł'),
  playlistTitleInvalid: dt('Nadaj playliście tytuł'),
  playlistDescriptionInvalid: dt('Ten opis jest za długi'),
  playlistPrivacyLabel: dt('Prywatność'),
  createPlaylist: dt('Utwórz'),
  playlistsTitle: dt('Playlisty'),
  playlistsLabel: dt('Twoje playlisty'),
  playlistEmpty: dt('Na tej playliście nie ma jeszcze nic'),
  playOrder: dt('{mode:enum}', {
    enum: { mode: { play: 'Odtwórz wszystko', shuffle: 'Losowo' } },
  }),
  sharePlaylist: dt('Udostępnij'),
  playlistOwner: dt('Autor: {name}'),
  playlistDuration: dt('{count:plural}, {duration}', {
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
  playlistDescriptionLabel: dt('Opis'),
  editPlaylist: dt('Edytuj szczegóły'),
  savePlaylist: dt('Zapisz'),
  deletePlaylist: dt('Usuń playlistę'),
  deletePlaylistTitle: dt('Usunąć tę playlistę?'),
  deletePlaylistBody: dt('Playlista i jej kolejność znikną. Filmy pozostaną tam, gdzie były.'),
  removeFromPlaylist: dt('Usuń z playlisty'),
  moveToTop: dt('Przenieś na początek'),
  moveToBottom: dt('Przenieś na koniec'),
  playlistItems: dt('Filmy na playliście {title}'),
} as const;
