import { dt } from '../define';

export const notifications = {
  emptyTitle: dt('Nie masz jeszcze powiadomień'),
  emptyDescription: dt(
    'Nowe filmy z subskrybowanych kanałów i odpowiedzi na Twoje komentarze pojawią się tutaj.'
  ),
  manageSubscriptions: dt('Zarządzaj subskrypcjami'),
  filter: dt('{filter:enum}', {
    enum: {
      filter: { all: 'Wszystkie', subscriptions: 'Subskrypcje', mentions: 'Odpowiedzi' },
    },
  }),
  filtersLabel: dt('Pokaż'),
  today: dt('Dzisiaj'),
  yesterday: dt('Wczoraj'),
  someone: dt('Ktoś'),
  uploaded: dt('{name} dodaje nowy film'),
  uploads: dt('{count:plural} z kanału {name}', {
    plural: {
      count: {
        one: '{?} nowy film',
        few: '{?} nowe filmy',
        many: '{?} nowych filmów',
        other: '{?} nowego filmu',
      },
    },
  }),
  live: dt('{name} nadaje teraz na żywo'),
  reply: dt('{name} odpowiada na Twój komentarz'),
  mention: dt('{name} wspomina o Tobie'),
  comment: dt('{name} komentuje Twój film'),
  heart: dt('{name} dodaje serce do Twojego komentarza'),
  teamInvite: dt('{name} zaprasza Cię do swojego zespołu'),
  processingReady: dt('Twój film jest gotowy do obejrzenia'),
  processingFailed: dt('Nie udało się przetworzyć Twojego filmu'),
  loadFailed: dt('Nie udało się wczytać powiadomień'),
  loadMoreFailed: dt('Nie udało się wczytać kolejnych powiadomień'),
  offline: dt('Jesteś offline. To powiadomienia wczytane ostatnio.'),
  markReadFailed: dt('Nie udało się oznaczyć powiadomień jako przeczytane'),
  view: dt('Pokaż'),
  channelsTitle: dt('Kanały'),
  channelsDescription: dt(
    'Zmień powyższe ustawienia dla jednego kanału. Wybrane to tylko nowe filmy, bez transmisji na żywo.'
  ),
  level: dt('{level:enum}', {
    enum: { level: { all: 'Wszystkie', highlights: 'Wybrane', none: 'Żadne' } },
  }),
  levelLabel: dt('Powiadomienia z kanału {name}'),
  levelFailed: dt('Nie udało się zapisać powiadomień z tego kanału'),
} as const;
