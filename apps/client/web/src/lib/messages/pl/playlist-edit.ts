import { dt } from '@vp/shared-messages';

const SORTS = {
  manual: 'Kolejność ręczna',
  added: 'Ostatnio dodane',
  duration: 'Najkrótsze najpierw',
  channel: 'Kanał',
  unwatched_first: 'Nieobejrzane najpierw',
} as const;

const REFUSALS = {
  FORBIDDEN: 'nie możesz go przenieść',
  PLAYLIST_ITEM_NOT_FOUND: 'nie ma go już na playliście',
  VIDEO_NOT_FOUND: 'film został usunięty',
  UNKNOWN: 'odrzucono',
} as const;

const LINE_STATUSES = {
  added: 'Dodano',
  duplicate: 'Już jest na playliście',
  not_found: 'Nie ma takiego filmu',
  unrecognised: 'To nie jest film z tej witryny',
} as const;

export const playlistEdit = {
  addedBy: dt('Dodane przez: {name}'),
  segmentRange: dt('Od {start} do {end}'),
  segmentFrom: dt('Od {start}'),
  sectionActions: dt('Działania dla sekcji {title}'),
  renameSection: dt('Zmień nazwę sekcji'),
  removeSection: dt('Usuń sekcję'),
  editItem: dt('Edytuj notatkę i fragment'),
  selectItem: dt('Zaznacz: {title}'),
  smartReadOnly: dt(
    'Ta playlista wypełnia się sama według reguł, więc nie można zmienić jej kolejności.'
  ),
  sortedReadOnly: dt('Posortowano do oglądania. Wybierz kolejność ręczną, aby przeciągać filmy.'),
  sortedLoadFailed: dt('Nie udało się wczytać posortowanych filmów'),
  toolbarLabel: dt('Narzędzia playlisty'),
  sortMenu: dt('Sortowanie: {sort:enum}', { enum: { sort: SORTS } }),
  sort: dt('{sort:enum}', { enum: { sort: SORTS } }),
  saveOrder: dt('Zapisz tę kolejność'),
  orderSaved: dt('Playlista ma teraz tę kolejność'),
  addSection: dt('Dodaj sekcję'),
  select: dt('Zaznacz'),
  import: dt('Importuj'),
  export: dt('Eksportuj'),
  selectionLabel: dt('Zaznaczone filmy'),
  selectedCount: dt('Zaznaczono: {count:number}'),
  moveTo: dt('Przenieś do'),
  copyTo: dt('Kopiuj do'),
  mergeInto: dt('Scal z'),
  sectionDialogTitle: dt('{mode:enum}', {
    enum: { mode: { add: 'Dodaj sekcję', rename: 'Zmień nazwę sekcji' } },
  }),
  sectionDialogBody: dt('Sekcja nazywa filmy pod nią. Sama nie zawiera filmu i nie jest liczona.'),
  sectionTitleLabel: dt('Tytuł sekcji'),
  sectionTitleInvalid: dt('Użyj od 1 do {max:number} znaków'),
  save: dt('Zapisz'),
  sectionSaved: dt('Zapisano sekcję'),
  sectionRemoved: dt('Usunięto sekcję'),
  itemDialogTitle: dt('Notatka i fragment'),
  itemMissing: dt('Tego filmu nie ma już na playliście'),
  noteLabel: dt('Notatka'),
  noteCount: dt('{count:number} z {max:number}'),
  noteInvalid: dt('Notatka może mieć najwyżej {max:number} znaków'),
  segmentLabel: dt('Fragment'),
  segmentWhole: dt('Odtwarzany jest cały film'),
  startLabel: dt('Początek'),
  endLabel: dt('Koniec'),
  addSegment: dt('Odtwarzaj tylko część'),
  clearSegment: dt('Wyczyść fragment'),
  timeInvalid: dt('Wpisz czas jako m:ss'),
  segmentInvalid: dt('Fragment trwa co najmniej sekundę i mieści się w filmie'),
  itemSaved: dt('Zapisano notatkę i fragment'),
  transferTitle: dt('{mode:enum}', {
    enum: { mode: { move: 'Przenieś na playlistę', copy: 'Kopiuj na playlistę' } },
  }),
  transferBody: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Wybierz, dokąd trafi zaznaczony film.',
        few: 'Wybierz, dokąd trafią {?} zaznaczone filmy.',
        many: 'Wybierz, dokąd trafi {?} zaznaczonych filmów.',
        other: 'Wybierz, dokąd trafi {?} zaznaczonego filmu.',
      },
    },
  }),
  nothingSelected: dt('Najpierw zaznacz filmy, a potem wybierz, dokąd mają trafić.'),
  targetsLabel: dt('Twoje playlisty'),
  smartTarget: dt('Wypełnia się sama według reguł'),
  targetsLoadFailed: dt('Nie udało się wczytać Twoich playlist'),
  transferAction: dt('{mode:enum}', { enum: { mode: { move: 'Przenieś', copy: 'Kopiuj' } } }),
  resultLanded: dt('{mode:enum}: {count:number}', {
    enum: { mode: { move: 'Przeniesiono', copy: 'Skopiowano', merge: 'Scalono' } },
  }),
  resultDuplicates: dt('Pominięto, bo już tam są: {count:number}'),
  resultRefused: dt('Odrzucono: {count:number}'),
  refusedItem: dt('{title}: {reason:enum}', { enum: { reason: REFUSALS } }),
  done: dt('Gotowe'),
  mergeTitle: dt('Scal playlisty'),
  mergeBody: dt(
    'Kopiuje po kolei filmy z najwyżej {max:number} playlist. Filmy, które już tam są, zostają pominięte.'
  ),
  mergeSourcesLabel: dt('Playlisty do scalenia'),
  mergeNoSources: dt('Nie masz innej playlisty do scalenia'),
  mergeTargetLabel: dt('Scal z'),
  mergeTarget: dt('{target:enum}', {
    enum: { target: { current: 'Tą playlistą', new: 'Nową playlistą' } },
  }),
  newTitleLabel: dt('Tytuł nowej playlisty'),
  deleteSources: dt('Potem usuń scalone playlisty'),
  mergeAction: dt('Scal'),
  importTitle: dt('Import i eksport'),
  importTabs: dt('Import lub eksport'),
  tab: dt('{tab:enum}', { enum: { tab: { import: 'Import', export: 'Eksport' } } }),
  importBody: dt(
    'Wklej eksport JSON lub CSV albo po jednym linku lub identyfikatorze filmu z tej witryny w wierszu. Link do innej witryny zostanie zgłoszony i nigdy nie zostanie otwarty.'
  ),
  formatLabel: dt('Format'),
  format: dt('{format:enum}', {
    enum: { format: { json: 'JSON', csv: 'CSV', urls: 'Linki lub identyfikatory' } },
  }),
  contentLabel: dt('Co zaimportować'),
  chooseFile: dt('Albo wybierz plik'),
  importEmpty: dt('Najpierw wklej coś do zaimportowania'),
  importTooLarge: dt('To więcej niż {max:number} bajtów'),
  importTooManyLines: dt('To {count:number} wierszy; naraz można dodać najwyżej {max:number}'),
  importAction: dt('Importuj'),
  importResultsLabel: dt('Wyniki importu'),
  importCount: dt('{status:enum}: {count:number}', { enum: { status: LINE_STATUSES } }),
  importLine: dt('Wiersz {row:number}: {status:enum}', {
    enum: { status: LINE_STATUSES },
    number: { row: { useGrouping: false } },
  }),
  exportBody: dt('Pobierz filmy, które możesz tu obejrzeć, z ich notatkami i fragmentami.'),
  exportAs: dt('{format:enum}', {
    enum: { format: { json: 'Pobierz JSON', csv: 'Pobierz CSV' } },
  }),
  exported: dt('Zapisano {name}'),
  followingTitle: dt('Obserwowane'),
  followingEmpty: dt('Tutaj pojawią się obserwowane playlisty'),
  unavailable: dt('Już niedostępna'),
  unfollow: dt('Przestań obserwować'),
  unfollowed: dt('Już jej nie obserwujesz'),
} as const;
