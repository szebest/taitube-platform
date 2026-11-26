import { dt } from '@vp/shared-messages';

const VARIANT = { a: 'A', b: 'B', c: 'C' } as const;

export const studioExperiments = {
  experimentsTitle: dt('Testy'),
  experimentsDescription: dt(
    'Pokaż każdemu widzowi jeden z dwóch lub trzech tytułów i porównaj czas oglądania, jaki każdy z nich przynosi na wyświetlenie miniatury. Zwycięzcę wybierasz Ty: nic nie zmienia się samo.'
  ),
  experimentsEmpty: dt('Brak testów.'),
  experimentsLoadFailed: dt('Nie udało się wczytać testów.'),
  experimentsListLabel: dt('Testy tego filmu'),
  experimentStartTitle: dt('Rozpocznij test'),
  experimentKind: dt('Co testować'),
  experimentKindOption: dt('{kind:enum}', {
    enum: { kind: { title: 'Tytuł', thumbnail: 'Miniatura', both: 'Tytuł i miniatura' } },
  }),
  experimentThumbnailsNeeded: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Testy miniatur porównują dwie miniatury tego filmu, a on ma jedną.',
        few: 'Testy miniatur porównują dwie miniatury tego filmu, a on ma {?}.',
        many: 'Testy miniatur porównują dwie miniatury tego filmu, a on ma {?}.',
        other: 'Testy miniatur porównują dwie miniatury tego filmu, a on ma {?}.',
      },
    },
  }),
  experimentVariantCount: dt('Warianty'),
  experimentVariantCountOption: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} wariant',
        few: '{?} warianty',
        many: '{?} wariantów',
        other: '{?} wariantu',
      },
    },
  }),
  experimentVariantTitle: dt('Tytuł, wariant {variant:enum}', { enum: { variant: VARIANT } }),
  experimentControlTitle: dt('Tytuł, wariant {variant:enum} (kontrolny)', {
    enum: { variant: VARIANT },
  }),
  experimentControlHint: dt('Obecny tytuł. Zmienisz go w karcie Szczegóły.'),
  experimentInvalidTitles: dt(
    'Nadaj każdemu wariantowi inny tytuł o długości od {min} do {max} znaków.'
  ),
  experimentRunningAlready: dt(
    'Na tym filmie trwa test. Zatrzymaj go lub zastosuj wariant, zanim rozpoczniesz kolejny.'
  ),
  experimentStart: dt('Rozpocznij test'),
  experimentStarted: dt('Test rozpoczęty'),
  experimentStartFailed: dt('Nie udało się rozpocząć testu.'),
  experimentHeading: dt('{kind:enum}', {
    enum: {
      kind: { title: 'Test tytułu', thumbnail: 'Test miniatury', both: 'Test tytułu i miniatury' },
    },
  }),
  experimentStatus: dt('{status:enum}', {
    enum: { status: { running: 'Trwa', finished: 'Zakończony', stopped: 'Zatrzymany' } },
  }),
  experimentStartedAt: dt('Rozpoczęty {date:date}', { date: { date: { style: 'medium' } } }),
  experimentStop: dt('Zatrzymaj test'),
  experimentStopped: dt('Test zatrzymany. Każdy widz znów widzi obecny tytuł.'),
  experimentStopFailed: dt('Nie udało się zatrzymać testu.'),
  experimentApply: dt('Zastosuj {variant:enum}', { enum: { variant: VARIANT } }),
  experimentApplied: dt('Wariant zastosowany'),
  experimentApplyFailed: dt('Nie udało się zastosować wariantu.'),
  experimentVariant: dt('Wariant {variant:enum}', { enum: { variant: VARIANT } }),
  experimentControl: dt('Wariant {variant:enum}, kontrolny', { enum: { variant: VARIANT } }),
  experimentWinner: dt('Zwycięzca'),
  experimentHeadline: dt('Czas oglądania na wyświetlenie'),
  experimentClickThrough: dt('Współczynnik klikalności'),
  experimentAverageView: dt('Średni czas obejrzenia'),
  experimentImpressions: dt('Wyświetlenia miniatury'),
  experimentVariantColumn: dt('Wariant'),
  experimentShows: dt('Pokazuje'),
  experimentThumbnail: dt('Miniatura: {source:enum}', { enum: { source: { poster: 'plakat' } } }),
  experimentNoValue: dt('Jeszcze nie'),
  experimentNotEnoughData: dt('Za mało danych'),
  experimentNotEnoughDataBody: dt(
    'Każdy wariant potrzebuje {min:number} wyświetleń miniatury, zanim jego liczby będą coś znaczyć.'
  ),
  experimentImpressionsSoFar: dt('{count:number} z {min:number} wyświetleń miniatury'),
  experimentResultsLabel: dt('Wyniki według wariantu'),
  experimentActions: dt('Działania'),
} as const;
