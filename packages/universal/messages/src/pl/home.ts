import { dt } from '../define';

export const home = {
  continueWatching: dt('Kontynuuj oglądanie'),
  fromSubscriptions: dt('Z Twoich subskrypcji'),
  becauseSearched: dt('Bo szukasz: {name}'),
  becauseWatched: dt('Bo oglądasz: {name}'),
  popularIn: dt('Popularne w: {name}'),
  trending: dt('Na czasie'),
  rising: dt('Wschodzący twórcy'),
  notInterested: dt('Nie interesuje mnie to'),
  hideChannel: dt('Nie polecaj tego kanału'),
  feedbackSaved: dt('Będziemy polecać mniej takich filmów'),
  feedbackUndo: dt('Cofnij'),
  feedbackUndoFailed: dt('Nie udało się tego cofnąć'),
  feedbackFailed: dt('Nie udało się tego zapisać. Film wrócił.'),
  empty: dt('Nie ma jeszcze nic do obejrzenia'),
  pickWindow: dt('Wybrane na dziś, zostało {left}'),
  pickWatch: dt('Oglądaj'),
  reason: dt('{kind:enum}', {
    enum: {
      kind: {
        continue: 'Kontynuuj od miejsca, w którym przerwano',
        subscription: 'Z kanału, który subskrybujesz',
        'co-watched': 'Widzowie oglądali też',
        'shared-tags': 'Podobne tematy',
        'same-channel': 'Z tego samego kanału',
        'same-category': 'W tej samej kategorii',
        category: 'Popularne w tej kategorii',
        trending: 'Na czasie',
        searched: 'Pasuje do Twojego ostatniego wyszukiwania',
        rising: 'Mały kanał, który widzowie oglądają do końca',
      },
    },
  }),
  signedOutSubscriptions: dt('Zaloguj się, aby zobaczyć, co opublikowały subskrybowane kanały'),
} as const;
