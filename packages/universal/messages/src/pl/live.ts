import { dt } from '../define';

export const live = {
  title: dt('Na żywo'),
  emptyTitle: dt('Teraz nic nie jest transmitowane na żywo'),
  emptyDescription: dt('Gdy kanał rozpocznie transmisję, zobaczysz tu jego strumień i czat.'),
  browse: dt('Przeglądaj filmy'),
  nowShelf: dt('Teraz na żywo'),
  watching: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} ogląda',
        few: '{?} oglądają',
        many: '{?} ogląda',
        other: '{?} ogląda',
        formatter: { notation: 'compact' },
      },
    },
  }),
  chatTitle: dt('Czat na żywo'),
  replayTitle: dt('Powtórka czatu'),
  showReplay: dt('Pokaż powtórkę czatu'),
  hideReplay: dt('Ukryj powtórkę czatu'),
  replayEmpty: dt('Do tego momentu nikt nie pisał na czacie.'),
  endedTitle: dt('Ta transmisja się zakończyła'),
  endedProcessing: dt('Nagranie pojawi się tutaj, gdy będzie gotowe.'),
  signInToChat: dt('Zaloguj się, aby pisać na czacie'),
  chatReconnecting: dt('Ponowne łączenie z czatem...'),
  chatSlowMode: dt('{seconds:plural}', {
    plural: {
      seconds: {
        one: 'Tryb powolny: jedna wiadomość na sekundę',
        few: 'Tryb powolny: jedna wiadomość co {?} sekundy',
        many: 'Tryb powolny: jedna wiadomość co {?} sekund',
        other: 'Tryb powolny: jedna wiadomość co {?} sekundy',
      },
    },
  }),
  chatUnavailable: dt('Nie możesz teraz pisać na czacie.'),
  chatSubscribersOnly: dt('Teraz na czacie mogą pisać tylko subskrybenci'),
  headDescription: dt('{name} na żywo na Taitube.'),
  you: dt('Ty'),
} as const;
