import { dt } from '@vp/shared-messages';

export const threads = {
  replyCount: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} odpowiedź',
        few: '{?} odpowiedzi',
        many: '{?} odpowiedzi',
        other: '{?} odpowiedzi',
        formatter: { notation: 'compact' },
      },
    },
  }),
  tabsLabel: dt('Dyskusja'),
  tab: dt('{tab:enum}', { enum: { tab: { comments: 'Komentarze', threads: 'Wątki' } } }),
  listTitle: dt('Wątki'),
  listEmpty: dt('Nie ma jeszcze wątków. Zacznij jeden w wybranym momencie filmu.'),
  listFailed: dt('Nie udało się wczytać wątków'),
  pinned: dt('Przypięty'),
  anchorAt: dt('Od {time}'),
  openThread: dt('Otwórz wątek'),
  startAt: dt('Zacznij wątek w {time}'),
  formTitle: dt('Zacznij wątek'),
  formDescription: dt(
    'Porozmawiaj o momencie {time}. Wątek pojawi się na pasku postępu, gdy dostanie odpowiedzi.'
  ),
  titleLabel: dt('Tytuł'),
  bodyLabel: dt('Szczegóły (opcjonalnie)'),
  counter: dt('{count:number} / {max:number}'),
  submit: dt('Zacznij wątek'),
  createFailed: dt('Nie udało się założyć wątku'),
  jumpTo: dt('Przejdź do {time}'),
  panelFailed: dt('Nie udało się wczytać wątku'),
  repliesTitle: dt('Odpowiedzi'),
  repliesEmpty: dt('Nie ma jeszcze odpowiedzi'),
  repliesFailed: dt('Nie udało się wczytać odpowiedzi'),
  replyFailed: dt('Nie udało się wysłać odpowiedzi'),
} as const;
