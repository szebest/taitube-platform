import { dt } from '@vp/shared-messages';

const SOURCES = {
  videos: 'Filmy',
  shorts: 'Shorty',
  posts: 'Posty',
  live: 'Transmisje na żywo',
  playlists: 'Playlisty',
  start_here: 'Zacznij tutaj',
  picked: 'Ręcznie wybrane pozycje',
  smart_playlist: 'Inteligentna playlista',
} as const;

const SORTS = {
  newest: 'Od najnowszych',
  popular: 'Najpopularniejsze',
  oldest: 'Od najstarszych',
  most_liked: 'Najbardziej lubiane',
  manual: 'Kolejność źródła',
  random: 'Losowo',
} as const;

const LAYOUTS = {
  shelf: 'Półka',
  grid: 'Siatka',
  list: 'Lista',
  hero: 'Jedna duża pozycja',
  masonry: 'Mozaika',
} as const;

const DENSITIES = {
  compact: 'Zwarty',
  comfortable: 'Przestronny',
} as const;

const SHOWN = {
  duration: 'Pokaż czas trwania',
  views: 'Pokaż wyświetlenia',
  date: 'Pokaż datę',
} as const;

const AUDIENCES = {
  everyone: 'Wszyscy',
  visitors: 'Osoby bez subskrypcji',
  subscribers: 'Subskrybenci',
  signed_in: 'Zalogowani widzowie',
} as const;

const BLOCKS = {
  content: 'Filmy i nie tylko',
  videos: 'Najnowsze filmy',
  shorts: 'Shorty',
  posts: 'Posty',
  live: 'Transmisje na żywo',
  playlists: 'Playlisty',
  start_here: 'Zacznij tutaj',
  rich_text: 'Tekst',
  links: 'Linki',
  featured_channels: 'Polecane kanały',
} as const;

const ICONS = {
  video: 'Film',
  playlist: 'Playlista',
  chat: 'Czat',
  live: 'Na żywo',
  heart: 'Serce',
  flame: 'Płomień',
  party: 'Ludzie',
  tag: 'Znacznik',
  globe: 'Glob',
} as const;

const TEMPLATES = {
  creator_starter: 'Start twórcy',
  series_focused: 'Skupiony na serii',
  blank: 'Pusty',
} as const;

const ABOUT = {
  creator_starter:
    'Na stronie głównej: Zacznij tutaj, najnowsze filmy, popularne filmy, playlisty i polecane kanały.',
  series_focused: 'Duży najnowszy odcinek, serie w siatce, Zacznij tutaj i karta Odcinki.',
  blank: 'Pusta strona główna. Wszystkie wbudowane karty zostają.',
} as const;

const VIEWS = {
  visitor: 'Nowy widz',
  subscriber: 'Subskrybent',
  mobile: 'Telefon',
} as const;

const STATUSES = {
  saved: 'Wszystkie zmiany zapisane',
  unsaved: 'Niezapisane zmiany',
  saving: 'Zapisywanie...',
  invalid: 'Popraw problem poniżej, aby zapisać',
  failed: 'Szkic nie został zapisany',
  conflict: 'Ktoś inny zapisał nowszy szkic',
} as const;

const SCHEDULE = {
  draft: 'Opublikuj ten szkic',
  published: 'Przywróć obecną stronę',
} as const;

const LANDING = {
  visitor: 'Nowi widzowie otwierają najpierw tę kartę',
  subscriber: 'Subskrybenci otwierają najpierw tę kartę',
} as const;

export const studioPageBuilder = {
  pageNav: dt('Strona kanału'),
  pageTitle: dt('Strona kanału'),
  pageDescription: dt(
    'Ułóż karty i sekcje strony kanału, zobacz ją jako widz lub subskrybent, a potem opublikuj ją albo zaplanuj.'
  ),
  pageForbidden: dt('Twoja rola nie pozwala edytować strony kanału.'),
  pageTabHidden: dt('Ukryta'),
  pageUntitledSection: dt('Sekcja bez tytułu'),
  pagePreviewChannels: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} polecany kanał',
        few: '{?} polecane kanały',
        many: '{?} polecanych kanałów',
        other: '{?} polecanego kanału',
      },
    },
  }),
  pageSourceLabel: dt('Źródło'),
  pageSourceOption: dt('{source:enum}', { enum: { source: SOURCES } }),
  pageSourcePlaylist: dt('Playlista: {title}'),
  pageFilterTags: dt('Tylko filmy z tymi tagami'),
  pageFilterTagsPlaceholder: dt('Dodaj tag'),
  pageFilterLastDays: dt('Tylko z ostatnich N dni'),
  pageFilterMinMinutes: dt('Najkrótszy, w minutach'),
  pageFilterMaxMinutes: dt('Najdłuższy, w minutach'),
  pageFilterHideWatched: dt('Ukryj to, co zalogowany widz już obejrzał'),
  pageSortLabel: dt('Sortowanie'),
  pageSortOption: dt('{sort:enum}', { enum: { sort: SORTS } }),
  pageLayoutLabel: dt('Układ'),
  pageLayoutOption: dt('{type:enum}', { enum: { type: LAYOUTS } }),
  pageColumns: dt('Kolumny: {count:number}'),
  pageColumnsLabel: dt('Kolumny'),
  pageItemCount: dt('Pozycje: {count:number}'),
  pageItemCountLabel: dt('Liczba pozycji'),
  pageSeeAll: dt('„Zobacz wszystko” otwiera'),
  pageSeeAllNone: dt('Nic'),
  pageTitleLabel: dt('Tytuł'),
  pageSubtitleLabel: dt('Podtytuł'),
  pageDensityLabel: dt('Gęstość'),
  pageDensityOption: dt('{density:enum}', { enum: { density: DENSITIES } }),
  pageShowFlag: dt('{field:enum}', { enum: { field: SHOWN } }),
  pageAudienceLabel: dt('Kto to widzi'),
  pageAudienceOption: dt('{audience:enum}', { enum: { audience: AUDIENCES } }),
  pageHideWhenEmpty: dt('Ukryj, gdy nie ma czego pokazać'),
  pageRichTextLabel: dt('Tekst'),
  pageRichTextHint: dt('Akapity, nagłówki, pogrubienie, kursywa, listy i linki https. Bez HTML.'),
  pageLinkLabel: dt('Nazwa linku {position:number}'),
  pageLinkUrl: dt('Adres linku {position:number}'),
  pageLinkRemove: dt('Usuń link {position:number}'),
  pageLinkAdd: dt('Dodaj link'),
  pageChannelRemove: dt('Usuń {name}'),
  pageChannelHandle: dt('Uchwyt kanału'),
  pageChannelNotFound: dt('Żaden kanał nie ma takiego uchwytu.'),
  pageChannelAdd: dt('Dodaj kanał'),
  pageGroupSource: dt('Źródło'),
  pageGroupFilters: dt('Filtry'),
  pageGroupLayout: dt('Sortowanie i układ'),
  pageGroupContent: dt('Treść'),
  pageGroupPresentation: dt('Wygląd'),
  pageGroupVisibility: dt('Widoczność'),
  pageSectionDrawerTitle: dt('Edytuj: {title}'),
  pageSectionDrawerDescription: dt(
    'Podgląd odzwierciedla każdą zmianę. Nic nie trafia na żywo, dopóki nie opublikujesz.'
  ),
  pageBlockOption: dt('{kind:enum}', { enum: { kind: BLOCKS } }),
  pageBlockDefaultTitle: dt('{kind:enum}', { enum: { kind: BLOCKS } }),
  pageAddSection: dt('Dodaj sekcję'),
  pageAddSectionLabel: dt('Rodzaje sekcji'),
  pageAddSectionSearch: dt('Szukaj rodzaju'),
  pageAddSectionEmpty: dt('Nie ma takiego rodzaju.'),
  pageSectionsLabel: dt('Sekcje tej karty'),
  pageSectionEdit: dt('Edytuj: {title}'),
  pageSectionShow: dt('Pokaż: {title}'),
  pageSectionHide: dt('Ukryj: {title}'),
  pageSectionDuplicate: dt('Powiel: {title}'),
  pageSectionDelete: dt('Usuń: {title}'),
  pageTabTitle: dt('Nazwa karty'),
  pageTabHide: dt('Ukryj tę kartę'),
  pageTabLanding: dt('{audience:enum}', { enum: { audience: LANDING } }),
  pageTabSlug: dt('Adres'),
  pageTabSlugHint: dt(
    '3 do 30 liter, cyfr lub myślników. Po publikacji karty nie można go zmienić.'
  ),
  pageTabIcon: dt('Ikona'),
  pageTabIconNone: dt('Brak'),
  pageTabIconOption: dt('{kind:enum}', { enum: { kind: ICONS } }),
  pageTabDescription: dt('Opis'),
  pageTabDuplicate: dt('Powiel kartę'),
  pageTabRemove: dt('Usuń kartę'),
  pageTabsLabel: dt('Karty'),
  pageTabShow: dt('Pokaż: {title}'),
  pageTabHideNamed: dt('Ukryj: {title}'),
  pageAddTab: dt('Dodaj kartę'),
  pageNewTabTitle: dt('Nowa karta'),
  pageFixedTab: dt(
    'Ta karta to stała siatka treści kanału, z sortowaniem i filtrem wybranym przez widza.'
  ),
  pageScheduleTitle: dt('Zaplanuj'),
  pageScheduleDescription: dt(
    'Zaplanuj zmianę strony na godzinę według własnego zegara. Zaplanuj obecną stronę, aby wróciła po sezonowej.'
  ),
  pageScheduleSource: dt('Co trafi na żywo'),
  pageScheduleSourceOption: dt('{source:enum}', { enum: { source: SCHEDULE } }),
  pageScheduleAt: dt('O'),
  pageScheduleConfirm: dt('Zaplanuj'),
  pageScheduleCancel: dt('Anuluj'),
  pageScheduleCancelled: dt('Plan anulowany'),
  pageScheduleCancelFailed: dt('Plan nie został anulowany.'),
  pageCancel: dt('Zamknij'),
  pageRevisionsTitle: dt('Opublikowane strony'),
  pageRevisionsDescription: dt(
    'Przywrócenie publikuje wcześniejszą stronę ponownie jako nową wersję.'
  ),
  pageRevisionsEmpty: dt('Nic jeszcze nie opublikowano.'),
  pageRevisionsLabel: dt('Opublikowane wersje strony'),
  pageRevisionNoNote: dt('Bez notatki'),
  pageRestored: dt('Przywrócono wersję {version:number}'),
  pageRestoreFailed: dt('Strona nie została przywrócona.'),
  pageTemplates: dt('Szablony'),
  pageTemplateTitle: dt('Zacznij od szablonu'),
  pageTemplateDescription: dt(
    'To zastępuje Twój szkic. Strona na żywo nie zmieni się, dopóki nie opublikujesz.'
  ),
  pageTemplateLabel: dt('Szablony'),
  pageTemplateOption: dt('{kind:enum}', { enum: { kind: TEMPLATES } }),
  pageTemplateAbout: dt('{kind:enum}', { enum: { kind: ABOUT } }),
  pageTemplateApply: dt('Zastąp mój szkic'),
  pagePreviewLabel: dt('Podgląd'),
  pagePreviewAs: dt('Podgląd jako'),
  pagePreviewOption: dt('{mode:enum}', { enum: { mode: VIEWS } }),
  pagePreviewFrame: dt('{mode:enum}', { enum: { mode: VIEWS } }),
  pageStatus: dt('{status:enum}', { enum: { status: STATUSES } }),
  pageHistory: dt('Historia'),
  pageSchedule: dt('Zaplanuj'),
  pageSaveDraft: dt('Zapisz szkic'),
  pagePublish: dt('Opublikuj'),
  pageGoToProblem: dt('Przejdź do niego'),
  pagePublished: dt('Strona opublikowana'),
  pagePublishFailed: dt('Strona nie została opublikowana.'),
  pageScheduled: dt('Strona zaplanowana'),
  pageScheduleFailed: dt('Strona nie została zaplanowana.'),
} as const;
