import { dt } from '@vp/shared-messages';

const ROLE = { editor: 'Edytor', contributor: 'Współtwórca' } as const;
const ROLE_IN_SENTENCE = { editor: 'edytorem', contributor: 'współtwórcą' } as const;

export const playlistPeople = {
  smartBadge: dt('Inteligentna'),
  smartSummary: dt('{mode:enum} {count:plural} · do {max:number} filmów', {
    enum: { mode: { all: 'Wszystkie z', any: 'Dowolny z' } },
    plural: {
      count: {
        one: '{?} warunku',
        few: '{?} warunków',
        many: '{?} warunków',
        other: '{?} warunku',
      },
    },
  }),
  forkedFrom: dt('Skopiowano z playlisty'),
  forkedFromGone: dt('Skopiowano z playlisty, która nie jest już dostępna'),
  collaboratorsLabel: dt('Współpracownicy'),
  moreCollaborators: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} współpracownik więcej',
        few: '{?} współpracowników więcej',
        many: '{?} współpracowników więcej',
        other: '{?} współpracownika więcej',
      },
    },
  }),
  follow: dt('Obserwuj'),
  following: dt('Obserwujesz'),
  fork: dt('Skopiuj'),
  forked: dt('Twoja kopia {title} jest gotowa'),
  pin: dt('Przypnij do biblioteki'),
  unpin: dt('Odepnij'),
  pinned: dt('Przypięto do biblioteki'),
  unpinned: dt('Odpięto od biblioteki'),
  more: dt('Więcej działań na playliście'),
  menu: dt('{action:enum}', {
    enum: {
      action: {
        collaborators: 'Współpracownicy',
        activity: 'Aktywność',
        shareLinks: 'Linki udostępniania',
        stats: 'Statystyki',
        settings: 'Ustawienia',
        rules: 'Edytuj reguły',
        freeze: 'Zamroź',
        leave: 'Opuść playlistę',
      },
    },
  }),
  frozen: dt('Zapisano obecną zawartość jako {title}'),
  collaboratorsTitle: dt('Współpracownicy'),
  collaboratorsDescription: dt(
    'Edytorzy dodają, usuwają, zmieniają kolejność i dodają notatki. Współtwórcy dodają filmy i zmieniają tylko to, co sami dodali.'
  ),
  peopleLabel: dt('Osoby na tej playliście'),
  owner: dt('Właściciel'),
  role: dt('{role:enum}', { enum: { role: ROLE } }),
  roleFor: dt('Rola: {name}'),
  removeFor: dt('Usuń: {name}'),
  someone: dt('Ktoś'),
  loadFailed: dt('Nie udało się wczytać współpracowników'),
  inviteHandleTitle: dt('Zaproś po nazwie kanału'),
  handleLabel: dt('Kanał'),
  handlePlaceholder: dt('Szukaj kanałów po nazwie lub identyfikatorze'),
  noChannels: dt('Żaden kanał nie pasuje'),
  roleLabel: dt('Rola'),
  sendInvite: dt('Wyślij zaproszenie'),
  invited: dt('Zaproszono: {name}'),
  inviteLinkTitle: dt('Link z zaproszeniem'),
  expiresAfter: dt('Wygasa po'),
  days: dt('{count:plural}', {
    plural: {
      count: { one: '{?} dniu', few: '{?} dniach', many: '{?} dniach', other: '{?} dnia' },
    },
  }),
  maxUses: dt('Użycia'),
  unlimited: dt('Bez limitu'),
  uses: dt('{count:plural}', {
    plural: {
      count: { one: '{?} użycie', few: '{?} użycia', many: '{?} użyć', other: '{?} użycia' },
    },
  }),
  createLink: dt('Utwórz link z zaproszeniem'),
  linkCreated: dt('Link z zaproszeniem utworzony'),
  pendingTitle: dt('Oczekujące zaproszenia'),
  pendingEmpty: dt('Żadne zaproszenie nie czeka'),
  linkInvite: dt('Każdy, kto ma link'),
  inviteState: dt('{state:enum}', {
    enum: {
      state: {
        active: 'Aktywne',
        expired: 'Wygasło',
        revoked: 'Unieważnione',
        exhausted: 'Wykorzystane',
      },
    },
  }),
  inviteMeta: dt('{role}, wygasa {date}'),
  usage: dt('Użyto {count:number} z {max:number}'),
  copyInviteLink: dt('Kopiuj link'),
  revoke: dt('Unieważnij'),
  revokeFor: dt('Unieważnij zaproszenie: {name}'),
  revoked: dt('Zaproszenie unieważnione'),
  leave: dt('Opuść playlistę'),
  left: dt('Opuszczono playlistę {title}'),
  activityTitle: dt('Aktywność'),
  activityDescription: dt('Każda zmiana tej playlisty z ostatnich 180 dni, od najnowszej.'),
  activityLabel: dt('Zmiany tej playlisty'),
  activityEmpty: dt('Nic się jeszcze nie zmieniło'),
  activityLoadFailed: dt('Nie udało się wczytać aktywności'),
  restore: dt('Przywróć'),
  restoreFor: dt('Przywróć: {title}'),
  restored: dt('Przywrócono na koniec playlisty'),
  aVideo: dt('film'),
  itemAdded: dt('{name} dodaje: {title}'),
  itemRemoved: dt('{name} usuwa: {title}'),
  autoRemoved: dt('{title} zniknął z listy po obejrzeniu'),
  itemsReordered: dt('{name} przesuwa {count:plural}', {
    plural: {
      count: { one: '{?} film', few: '{?} filmy', many: '{?} filmów', other: '{?} filmu' },
    },
  }),
  noteEdited: dt('{name} zmienia notatkę przy: {title}'),
  sectionAdded: dt('{name} dodaje sekcję {title}'),
  collaboratorJoined: dt('{name} dołącza jako {role:enum}', { enum: { role: ROLE_IN_SENTENCE } }),
  collaboratorAdded: dt('{name} dodaje kogoś jako {role:enum}', {
    enum: { role: ROLE_IN_SENTENCE },
  }),
  collaboratorLeft: dt('{name} opuszcza playlistę'),
  collaboratorRemoved: dt('{name} usuwa współpracownika'),
  roleChanged: dt('{name} czyni współpracownika {role:enum}', {
    enum: { role: ROLE_IN_SENTENCE },
  }),
  settingsChanged: dt('{name} zmienia ustawienia'),
  itemRestored: dt('{name} przywraca: {title}'),
  inviteTitle: dt('Dołącz do playlisty'),
  inviteBody: dt(
    'Zaproszono Cię do wspólnej pracy nad playlistą. Zaakceptuj, aby dołączyć z rolą, którą daje zaproszenie.'
  ),
  accept: dt('Akceptuj'),
  decline: dt('Odrzuć'),
  joined: dt('Dołączono do playlisty'),
  declined: dt('Zaproszenie odrzucone'),
  inviteGoneTitle: dt('To zaproszenie wygasło lub zostało wykorzystane'),
  inviteGoneBody: dt('Poproś właściciela playlisty o nowe zaproszenie.'),
  goHome: dt('Przejdź na stronę główną'),
  shareExpiredTitle: dt('Ten link udostępniania już nie działa'),
  shareExpiredBody: dt(
    'Wygasł lub został unieważniony. Poproś osobę, która udostępniła playlistę, o nowy.'
  ),
  smartNotSavable: dt('Inteligentna: sama wybiera filmy'),
} as const;
