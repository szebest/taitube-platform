import { dt } from '../engine';

export const accounts = {
  switcherTitle: dt('Przełącz konto lub kanał'),
  switcherSearch: dt('Znajdź konto lub kanał'),
  switcherOpen: dt('Przełącz konto lub kanał'),
  switcherShortcut: dt('Alt+Shift+A'),
  groupAccounts: dt('Konta'),
  unread: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} nieprzeczytane',
        few: '{?} nieprzeczytane',
        many: '{?} nieprzeczytanych',
        other: '{?} nieprzeczytanych',
      },
    },
  }),
  newComments: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} nowy komentarz',
        few: '{?} nowe komentarze',
        many: '{?} nowych komentarzy',
        other: '{?} nowych komentarzy',
      },
    },
  }),
  glanceNothing: dt('Nic nowego'),
  expired: dt('Sesja wygasła, zaloguj się'),
  addAccount: dt('Dodaj konto'),
  createChannel: dt('Utwórz kanał'),
  manage: dt('Zarządzaj kontami'),
  signOutThis: dt('Wyloguj się z tego konta'),
  signOutAll: dt('Wyloguj się ze wszystkich kont'),
  nowBrowsing: dt('Przeglądasz teraz jako {name}'),
  undo: dt('Cofnij'),
  switchFailed: dt('Nie udało się przełączyć na {name}'),
  commentingAs: dt('Komentujesz jako {name}'),
  replyingAs: dt('Odpowiadasz jako {name}'),
  subscribingAs: dt('Subskrybujesz jako {name}'),
  switch: dt('Przełącz'),
  identityChanged: dt('Po napisaniu tego przełączyłeś konto lub kanał. Nic nie zostało wysłane.'),
  sendAnyway: dt('Wyślij mimo to'),
  openAs: dt('Otwórz jako...'),
  tabTitle: dt('@{handle} - {title}'),
  createChannelTitle: dt('Utwórz kanał'),
  createChannelBody: dt('Osobny kanał z własnym identyfikatorem, filmami i subskrybentami.'),
  channelHandle: dt('Identyfikator'),
  channelName: dt('Nazwa kanału'),
  create: dt('Utwórz'),
  channelCreated: dt('Utworzono {name}'),
  makePrimary: dt('Ustaw jako główny'),
  primary: dt('Główny'),
  promoteFailed: dt('Nie udało się ustawić kanału jako głównego'),
  signInUnknownDevice: dt('Na nieznanym urządzeniu'),
  noSignIns: dt('Brak zapisanych logowań.'),
  loadMore: dt('Wczytaj więcej'),
  teamRole: dt('{role:enum}', {
    enum: {
      role: {
        manager: 'Menedżer',
        editor: 'Edytor',
        moderator: 'Moderator',
        analytics: 'Analityk',
      },
    },
  }),
} as const;
