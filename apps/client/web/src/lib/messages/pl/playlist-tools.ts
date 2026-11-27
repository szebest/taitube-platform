import { dt } from '@vp/shared-messages';

const DAYS = { one: '{?} dzień', few: '{?} dni', many: '{?} dni', other: '{?} dnia' } as const;

export const playlistTools = {
  shareLinksTitle: dt('Linki udostępniania'),
  shareLinksDescription: dt(
    'Link udostępniania pozwala każdemu, kto go ma, otworzyć tę playlistę bez względu na jej widoczność. Każdy film nadal wymaga własnego prawa do obejrzenia.'
  ),
  label: dt('Etykieta'),
  labelHint: dt('Opcjonalna, do {max:number} znaków. Widzisz ją tylko Ty.'),
  labelTooLong: dt('Użyj etykiety o długości do {max:number} znaków'),
  expiresAfter: dt('Wygasa po'),
  expiry: dt('{expiry:enum}', {
    enum: {
      expiry: {
        '1h': '1 godzinie',
        '24h': '24 godzinach',
        '7d': '7 dniach',
        '30d': '30 dniach',
        never: 'Nigdy',
      },
    },
  }),
  createLink: dt('Utwórz link'),
  linkCreated: dt('Link udostępniania utworzony'),
  linksLabel: dt('Linki udostępniania tej playlisty'),
  linksEmpty: dt('Brak linków udostępniania'),
  linksLoadFailed: dt('Nie udało się wczytać linków udostępniania'),
  noLabel: dt('Bez etykiety'),
  linkState: dt('{state:enum}', {
    enum: { state: { active: 'Aktywny', expired: 'Wygasł', revoked: 'Unieważniony' } },
  }),
  opens: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} otwarcie',
        few: '{?} otwarcia',
        many: '{?} otwarć',
        other: '{?} otwarcia',
      },
    },
  }),
  neverExpires: dt('Nigdy nie wygasa'),
  expires: dt('Wygasa {date}'),
  copyFor: dt('Kopiuj link {label}'),
  copy: dt('Kopiuj link'),
  revokeFor: dt('Unieważnij link {label}'),
  revoke: dt('Unieważnij'),
  linkRevoked: dt('Link udostępniania unieważniony'),
  statsTitle: dt('Statystyki playlisty'),
  statsDescription: dt(
    'Widzisz je tylko Ty. Ostatnie minuty pojawią się po następnym przeliczeniu.'
  ),
  rangeLabel: dt('Zakres'),
  range: dt('{range:enum}', {
    enum: { range: { '7d': '7 dni', '30d': '30 dni', '90d': '90 dni' } },
  }),
  measure: dt('{metric:enum}', {
    enum: {
      metric: {
        opens: 'Otwarcia strony',
        plays: 'Odtworzenia',
        follows: 'Obserwacje',
        forks: 'Kopie',
      },
    },
  }),
  topTitle: dt('Najczęściej odtwarzane'),
  topEmpty: dt('Nic jeszcze nie odtworzono z tej playlisty'),
  plays: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} odtworzenie',
        few: '{?} odtworzenia',
        many: '{?} odtworzeń',
        other: '{?} odtworzenia',
      },
    },
  }),
  settingsTitle: dt('Ustawienia playlisty'),
  autoRemove: dt('Usuwaj obejrzane filmy'),
  autoRemoveHint: dt(
    'Film, który obejrzysz do końca, znika z listy. Aktywność może go przywrócić.'
  ),
  autoRemoveBlocked: dt('{reason:enum}', {
    enum: {
      reason: {
        collaborators: 'Niedostępne, gdy nad playlistą pracują inni',
        smart: 'Inteligentna playlista sama wybiera filmy, więc nic nie jest usuwane',
      },
    },
  }),
  coverLabel: dt('Okładka'),
  coverMode: dt('{mode:enum}', {
    enum: {
      mode: { auto: 'Pierwsze filmy', item: 'Jeden z jej filmów', custom: 'Własny obraz' },
    },
  }),
  coverVideo: dt('Film na okładce'),
  coverDrop: dt('Upuść tu obraz JPEG, PNG lub WebP albo go wybierz'),
  coverHint: dt(
    'Co najmniej 640 x 360 px i najwyżej 2 MB; okładką zostaje środkowy fragment 16:9.'
  ),
  coverSelected: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Wybrany obraz:',
        few: 'Wybrane obrazy:',
        many: 'Wybrane obrazy:',
        other: 'Wybrane obrazy:',
      },
    },
  }),
  coverTooSmall: dt('Ten obraz jest za mały: musi mieć co najmniej {minWidth} x {minHeight} px.'),
  coverUnreadable: dt('Nie udało się odczytać tego pliku jako obrazu.'),
  coverUploading: dt('Przygotowujemy Twoją okładkę'),
  coverUploadFailed: dt('Ten obraz nie mógł zostać okładką. Spróbuj innego.'),
  saved: dt('Ustawienia zapisane'),
  rulesTitle: dt('Edytuj reguły'),
  rulesDescription: dt('Playlista wybiera filmy według tych reguł przy każdym otwarciu.'),
  rulesLabel: dt('Reguły'),
  rulesSaved: dt('Reguły zapisane'),
  saveRules: dt('Zapisz reguły'),
  kindLabel: dt('Rodzaj'),
  kind: dt('{kind:enum}', {
    enum: { kind: { playlist: 'Playlista', smart: 'Inteligentna playlista' } },
  }),
  matchLabel: dt('Dopasuj'),
  match: dt('{mode:enum}', {
    enum: { mode: { all: 'Wszystkie warunki', any: 'Dowolny warunek' } },
  }),
  noConditions: dt('Bez warunków zawiera najnowsze publiczne filmy.'),
  addCondition: dt('Dodaj warunek'),
  conditionLabel: dt('Warunek {position:number}'),
  removeCondition: dt('Usuń warunek {position:number}'),
  fieldLabel: dt('Pole warunku {position:number}'),
  field: dt('{field:enum}', {
    enum: {
      field: {
        channel: 'Kanał',
        tag: 'Tag',
        category: 'Kategoria',
        duration: 'Długość',
        format: 'Format',
        newer_than: 'Nowsze niż',
        unwatched: 'Nieobejrzane',
      },
    },
  }),
  channelsLabel: dt('Kanały, do {max:number}'),
  removeChannel: dt('Usuń: {name}'),
  tagsLabel: dt('Tagi, do {max:number}'),
  categoryLabel: dt('Kategoria'),
  durationOpLabel: dt('Długość jest'),
  durationOp: dt('{mode:enum}', {
    enum: { mode: { under: 'Krótsza niż', over: 'Dłuższa niż', between: 'Pomiędzy' } },
  }),
  minutesLabel: dt('Minuty'),
  minutes: dt('{count:plural}', {
    plural: {
      count: { one: '{?} minuta', few: '{?} minuty', many: '{?} minut', other: '{?} minuty' },
    },
  }),
  minutesRange: dt('Od {min:number} do {max:number} minut'),
  formatLabel: dt('Format'),
  format: dt('{format:enum}', { enum: { format: { long: 'Długie filmy', short: 'Shorty' } } }),
  daysLabel: dt('Dni'),
  days: dt('{count:plural}', { plural: { count: DAYS } }),
  unwatchedHint: dt('Filmy, których nie obejrzano do końca'),
  sortLabel: dt('Sortuj'),
  sort: dt('{sort:enum}', {
    enum: {
      sort: {
        newest: 'Od najnowszych',
        oldest: 'Od najstarszych',
        popular: 'Najczęściej oglądane',
        shortest: 'Od najkrótszych',
        longest: 'Od najdłuższych',
      },
    },
  }),
  limitLabel: dt('Najwięcej filmów'),
  limit: dt('{count:plural}', {
    plural: {
      count: { one: '{?} film', few: '{?} filmy', many: '{?} filmów', other: '{?} filmu' },
    },
  }),
} as const;
