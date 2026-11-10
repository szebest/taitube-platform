import { dt } from '../define';

export const studioModeration = {
  moderationBulkLabel: dt('Moderuj zaznaczone komentarze'),
  moderationAction: dt('{action:enum}', {
    enum: {
      action: {
        approve: 'Zatwierdź',
        hide: 'Ukryj',
        remove: 'Usuń',
        shadow_ban: 'Cichy ban',
        ban: 'Zbanuj',
      },
    },
  }),
  moderationBulkDone: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} komentarz zmieniony',
        few: '{?} komentarze zmienione',
        many: '{?} komentarzy zmienionych',
        other: '{?} komentarza zmienionego',
      },
    },
  }),
  moderationBulkPartial: dt('Gotowe: {done:number} z {total:number}, odrzucone: {failed:number}'),
  moderationBulkRefusal: dt('{id}: {reason}'),
  moderationBulkFailed: dt('Nic nie zostało zmienione. Spróbuj ponownie.'),
  moderationReasonTitle: dt('{action:enum}', {
    enum: {
      action: {
        hide: 'Ukryj z powodem',
        remove: 'Usuń z powodem',
        ban: 'Zbanuj z powodem',
      },
    },
  }),
  moderationReasonDescription: dt('{action:enum}', {
    enum: {
      action: {
        hide: 'Autor widzi, że komentarz jest ukryty, i dlaczego.',
        remove: 'Autor dowiaduje się, że komentarz usunięto, i dlaczego.',
        ban: 'Autor nie może komentować ani reagować i widzi dlaczego.',
      },
    },
  }),
  moderationReasonLabel: dt('Powód'),
  moderationReasonOption: dt('{reason:enum}', {
    enum: {
      reason: {
        spam: 'Spam',
        harassment: 'Nękanie',
        hate: 'Nienawiść',
        misinformation: 'Dezinformacja',
        other: 'Coś innego',
        off_topic: 'Nie na temat',
      },
    },
  }),
  moderationNoteLabel: dt('Wiadomość do autora'),
  moderationDurationLabel: dt('Ban na'),
  moderationDurationOption: dt('{duration:enum}', {
    enum: {
      duration: {
        '1h': '1 godzinę',
        '24h': '24 godziny',
        '7d': '7 dni',
        '30d': '30 dni',
        forever: 'Do odwołania',
      },
    },
  }),
  queueNav: dt('Kolejka do przejrzenia'),
  queueTitle: dt('Kolejka do przejrzenia'),
  queueListLabel: dt('Wstrzymane komentarze'),
  queueEmptyTitle: dt('Nic do przejrzenia'),
  queueEmptyDescription: dt('Tutaj czekają komentarze wstrzymane do przejrzenia.'),
  queueFailed: dt('Nie udało się wczytać kolejki.'),
  queueHeldReason: dt('{reason:enum}', {
    enum: {
      reason: {
        review_all: 'Wstrzymany do przejrzenia',
        link: 'Zawiera link',
        blocked_word: 'Zawiera zablokowane słowo',
        unknown: 'Wstrzymany',
      },
    },
  }),
  queueOnVideo: dt('Pod filmem {title}'),
  queueInThread: dt('Odpowiedź w wątku'),
  queueWatch: dt('Otwórz film'),
  queueHistoryTitle: dt('Ostatnie komentarze tego autora'),
  queueHistoryEmpty: dt('Brak innych komentarzy na Twoim kanale.'),
  queueHistoryFailed: dt('Nie udało się wczytać jego innych komentarzy.'),
  queueState: dt('{state:enum}', {
    enum: { state: { published: 'Opublikowany', held: 'Wstrzymany', hidden: 'Ukryty' } },
  }),
  queueActionsLabel: dt('Działania na otwartym komentarzu'),
  queueSelection: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Działanie na {?} zaznaczonym komentarzu',
        few: 'Działanie na {?} zaznaczonych komentarzach',
        many: 'Działanie na {?} zaznaczonych komentarzach',
        other: 'Działanie na {?} zaznaczonego komentarza',
      },
    },
  }),
  queueSelect: dt('Zaznacz'),
  queueUnselect: dt('Odznacz'),
  queuePrevious: dt('Poprzedni'),
  queueNext: dt('Następny'),
  queueDisclosure: dt('{disclosure:enum}', {
    enum: { disclosure: { silent: 'Po cichu', visible: 'Widocznie' } },
  }),
  queueFlip: dt('Następne działanie: {disclosure:enum}', {
    enum: { disclosure: { silent: 'Po cichu', visible: 'Widocznie' } },
  }),
  queueHelp: dt('Skróty'),
  queueHelpTitle: dt('Skróty klawiszowe'),
  queueHelpDescription: dt('Działają wszędzie na stronie poza polem tekstowym.'),
  queueKey: dt('{key:enum}', {
    enum: {
      key: {
        j: 'Następny komentarz',
        k: 'Poprzedni komentarz',
        a: 'Zatwierdź',
        r: 'Usuń, z powodem',
        h: 'Ukryj',
        b: 'Zbanuj autora',
        v: 'Przełącz następne działanie między po cichu a widocznie',
        x: 'Zaznacz lub odznacz',
        '?': 'Pokaż tę listę',
      },
    },
  }),
} as const;
