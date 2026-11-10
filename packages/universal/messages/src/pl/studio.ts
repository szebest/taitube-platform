import { dt } from '../define';
import { studioAdmin } from './studio-admin';
import { studioCaptions } from './studio-captions';
import { studioChannel } from './studio-channel';
import { studioComments } from './studio-comments';
import { studioImages } from './studio-images';
import { studioLive } from './studio-live';
import { studioPicks } from './studio-picks';
import { studioScreening } from './studio-screening';
import { studioTeam } from './studio-team';

const VIDEO_STATUS = {
  UPLOADING: 'Przesyłanie',
  UPLOADED: 'Przesłano',
  PROBING: 'Analizowanie',
  PROCESSING: 'Przetwarzanie',
  READY: 'Gotowe',
  FAILED: 'Niepowodzenie',
  REJECTED: 'Odrzucone',
  ABANDONED: 'Porzucone',
  DELETED: 'Usunięte',
  LIVE: 'Na żywo',
  HELD: 'Wstrzymane',
} as const;

export const studio = {
  title: dt('Studio twórcy'),
  backToWeb: dt('Wróć do Taitube'),
  signIn: dt('Zaloguj się do studia'),
  retentionTitle: dt('Utrzymanie widowni'),
  retentionChart: dt('Widzowie, którzy dotarli do każdego momentu filmu'),
  processingStatus: dt('Stan przetwarzania'),
  processing: dt('{status:enum}, zakodowano {overall:number}%', {
    enum: {
      status: VIDEO_STATUS,
    },
    number: { overall: { maximumFractionDigits: 0 } },
  }),
  uploadTitle: dt('Prześlij film'),
  editTitle: dt('Edycja filmu: {title}'),
  processingStatusFailed: dt('Nie udało się wczytać stanu przetwarzania.'),
  navUpload: dt('Prześlij'),
  navLibrary: dt('Filmy'),
  libraryTitle: dt('Twoje filmy'),
  libraryFilter: dt('Filtruj według tytułu'),
  libraryRange: dt('{from:number} do {to:number}'),
  libraryEmpty: dt('Nie przesłano jeszcze żadnego filmu'),
  libraryNoMatch: dt('Żaden film nie pasuje do filtra'),
  libraryColumnVideo: dt('Film'),
  libraryColumnStatus: dt('Status'),
  libraryColumnVisibility: dt('Widoczność'),
  libraryColumnDate: dt('Data'),
  libraryColumnViews: dt('Wyświetlenia'),
  libraryColumnLikes: dt('Polubienia'),
  libraryColumnComments: dt('Komentarze'),
  libraryColumnActions: dt('Działania'),
  inspectorTitle: dt('Szczegóły filmu'),
  inspectorFailed: dt('Nie udało się wczytać szczegółów filmu.'),
  videoStatus: dt('{status:enum}', {
    enum: {
      status: VIDEO_STATUS,
    },
  }),
  videoActions: dt('Działania dla filmu {title}'),
  editVideo: dt('Edytuj'),
  videoAnalytics: dt('Statystyki'),
  watchOnWeb: dt('Obejrzyj w Taitube'),
  ...studioAdmin,
  ...studioCaptions,
  ...studioComments,
  ...studioChannel,
  ...studioImages,
  ...studioLive,
  ...studioPicks,
  ...studioScreening,
  ...studioTeam,
  deleteVideo: dt('Usuń'),
  setVisibility: dt('Widoczność'),
  deleteConfirmTitle: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Usunąć ten film?',
        few: 'Usunąć {?} filmy?',
        many: 'Usunąć {?} filmów?',
        other: 'Usunąć {?} filmu?',
      },
    },
  }),
  deleteConfirmBody: dt(
    'Usunięte filmy znikają z Twojej biblioteki i przestają być odtwarzane. Tej operacji nie można cofnąć.'
  ),
  deleteConfirm: dt('Usuń'),
  deleteCancel: dt('Anuluj'),
  batchDeleted: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film usunięty',
        few: '{?} filmy usunięte',
        many: '{?} filmów usuniętych',
        other: '{?} filmu usuniętego',
      },
    },
  }),
  batchVisibilitySet: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film zaktualizowany',
        few: '{?} filmy zaktualizowane',
        many: '{?} filmów zaktualizowanych',
        other: '{?} filmu zaktualizowanego',
      },
    },
  }),
  batchPartial: dt(
    'Gotowe: {done:number} z {total:number}, niepowodzenia: {failed:number}. Te, którym się nie udało, pozostają zaznaczone.'
  ),
  batchFailed: dt('Nic nie zostało zmienione. Spróbuj ponownie.'),
  navAnalytics: dt('Statystyki'),
  analyticsTitle: dt('Statystyki'),
  videoAnalyticsTitle: dt('Statystyki filmu'),
  analyticsEmptyTitle: dt('W tym okresie nie ma jeszcze wyświetleń'),
  analyticsEmptyDescription: dt('Liczby i wykresy pojawią się, gdy ktoś obejrzy film.'),
  analyticsRange: dt('Zakres czasu'),
  analyticsRangeOption: dt('{range:enum}', {
    enum: { range: { '7d': '7 dni', '30d': '30 dni', '90d': '90 dni', lifetime: 'Cały okres' } },
  }),
  kpiLabel: dt('{metric:enum}, {range:enum}', {
    enum: {
      metric: {
        views: 'Wyświetlenia',
        'watch-time': 'Czas oglądania',
        'average-view-duration': 'Średni czas wyświetlenia',
        'net-subscribers': 'Przyrost subskrybentów',
      },
      range: {
        '7d': 'ostatnie 7 dni',
        '30d': 'ostatnie 30 dni',
        '90d': 'ostatnie 90 dni',
        lifetime: 'cały okres',
      },
    },
  }),
  kpiChange: dt('{change} w porównaniu z poprzednim okresem'),
  viewsChartTitle: dt('Wyświetlenia dziennie'),
  hourlyChartTitle: dt('Wyświetlenia na godzinę, ostatnie {hours:number} godz.'),
  viewsChartSeries: dt('Wyświetlenia'),
  chartColumnDay: dt('Dzień'),
  chartColumnHour: dt('Godzina'),
  chartColumnViews: dt('Wyświetlenia'),
  retentionPosition: dt('Miejsce w filmie'),
  retentionViewers: dt('Widzowie'),
  uploadDescription: dt(
    'Wybierz film i nadaj mu tytuł. Możesz zamknąć to okno, gdy film się przesyła.'
  ),
  uploadDrop: dt('Przeciągnij tutaj film albo kliknij, aby wybrać plik'),
  uploadFieldTitle: dt('Tytuł filmu'),
  uploadFieldVisibility: dt('Widoczność'),
  uploadSubmit: dt('Prześlij'),
  uploadCancel: dt('Anuluj'),
  uploadBusy: dt('Inny film nadal się przesyła. Kolejny możesz zacząć, gdy ten zostanie wysłany.'),
  uploadDockTitle: dt('Przesyłanie'),
  uploadSending: dt('Przesyłanie: {title}'),
  uploadSendingDetail: dt('{progress} · {sent} / {total}'),
  uploadSendingLabel: dt('Postęp przesyłania: {title}'),
  uploadFailed: dt('Nie udało się przesłać: {title}'),
  uploadDismiss: dt('Odrzuć'),
  uploadCancelItem: dt('Anuluj przesyłanie: {title}'),
  uploadOverall: dt('Łącznie'),
  uploadThumbnail: dt('Miniatura'),
  uploadStageLabel: dt('{stage}: {title}'),
  uploadProcessingFailed: dt('Nie udało się wczytać stanu przetwarzania.'),
  editFieldTitle: dt('Tytuł filmu'),
  editFieldDescription: dt('Opis'),
  editFieldVisibility: dt('Widoczność'),
  editFieldCategory: dt('Kategoria'),
  editFieldTags: dt('Tagi'),
  editTagsPlaceholder: dt('Dodaj tag i naciśnij Enter'),
  editTagRemove: dt('Usuń tag {tag}'),
  editCategoryNone: dt('Bez kategorii'),
  editCategoriesFailed: dt('Nie udało się wczytać kategorii.'),
  editPreview: dt('Podgląd opisu'),
  editPreviewEmpty: dt('Nie ma jeszcze nic do podglądu'),
  editThumbnailTitle: dt('Miniatura'),
  editThumbnailAlt: dt('Bieżąca miniatura'),
  editThumbnailPoster: dt('Użyj wygenerowanej klatki'),
  editSave: dt('Zapisz zmiany'),
  editSaved: dt('Zmiany zapisane'),
  editFailed: dt('Nie udało się zapisać zmian'),
  editConflictTitle: dt('Ten film zmienił się podczas edycji'),
  editConflictBody: dt(
    'Nowsza wersja została zapisana gdzie indziej. Odśwież, aby ją zobaczyć i porzucić swoje zmiany, albo nadpisz ją swoją wersją.'
  ),
  editConflictReload: dt('Odśwież'),
  editConflictOverwrite: dt('Nadpisz'),
  appearanceSettings: dt('Wszystkie ustawienia wyglądu'),
  navCustomization: dt('Kanał'),
  customizationTitle: dt('Personalizacja kanału'),
  saveSection: dt('Zapisz'),
  sectionSaving: dt('Zapisywanie'),
  sectionSaved: dt('Zapisano'),
  sectionNotSaved: dt('Nie udało się zapisać. Spróbuj ponownie.'),
  identityTitle: dt('Nazwa i nazwa użytkownika'),
  identityDescription: dt('Jak nazywa się Twój kanał i jak można go znaleźć.'),
  displayNameLabel: dt('Nazwa kanału'),
  displayNameInvalid: dt('Użyj od 1 do 100 znaków.'),
  handleLabel: dt('Nazwa użytkownika'),
  handleHint: dt('Od 3 do 30 liter, cyfr, kropek, myślników lub podkreśleń.'),
  aboutTitle: dt('Informacje'),
  aboutDescription: dt('To, co widzowie czytają na Twoim kanale.'),
  bioLabel: dt('Opis'),
  bioInvalid: dt('Użyj najwyżej 5000 znaków.'),
  linksLabel: dt('Linki'),
  linkTitleLabel: dt('Tytuł linku {position}'),
  linkUrlLabel: dt('Adres linku {position}'),
  addLink: dt('Dodaj link'),
  removeLink: dt('Usuń link {position}'),
  brandTitle: dt('Kolor marki'),
  brandDescription: dt('Przyciski, linki i wyróżnienia na stronie Twojego kanału mają ten kolor.'),
  brandLabel: dt('Kolor'),
  brandHint: dt('Zapisz go jako #rrggbb. Zostaw puste, by używać akcentu każdego widza.'),
  brandInvalid: dt('Użyj koloru takiego jak #3366cc.'),
  brandPreviewDark: dt('Na ciemnym'),
  brandPreviewLight: dt('Na jasnym'),
  startHereTitle: dt('Zacznij tutaj'),
  startHereDescription: dt(
    'Przypnij do {max} filmów, w kolejności, w jakiej powinien je obejrzeć nowy widz.'
  ),
  startHerePinsLabel: dt('Przypięte filmy'),
  startHereEmptyNote: dt(
    'Widzowie widzą Twoje najczęściej oglądane filmy, dopóki żadnych nie przypniesz'
  ),
  startHereAdd: dt('Dodaj filmy'),
  startHereAddLabel: dt('Publiczne filmy, które możesz przypiąć'),
  startHereSearch: dt('Szukaj wśród swoich filmów'),
  startHereNothingToAdd: dt('Nie został żaden publiczny, gotowy film do przypięcia.'),
  startHereLoadMore: dt('Pokaż więcej filmów'),
  startHereLimit: dt(
    'Przypięto {max} filmów, czyli tyle, ile mieści sekcja. Usuń jeden, aby dodać kolejny.'
  ),
  startHereRemove: dt('Usuń {title}'),
  startHereViewChannel: dt('Zobacz swój kanał'),
  startHereSaved: dt('Sekcja Zacznij tutaj zapisana'),
  startHereNotSaved: dt('Nie zapisano sekcji Zacznij tutaj'),
} as const;
