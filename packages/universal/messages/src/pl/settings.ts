import { dt } from '../define';
import { settingsRows } from './settings-rows';

export const settings = {
  title: dt('Ustawienia'),
  navLabel: dt('Sekcje ustawień'),
  searchLabel: dt('Szukaj w ustawieniach'),
  searchPlaceholder: dt('Szukaj w ustawieniach'),
  noMatches: dt('Żadne ustawienie nie pasuje do: {query}'),
  resultCount: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} ustawienie',
        few: '{?} ustawienia',
        many: '{?} ustawień',
        other: '{?} ustawienia',
      },
    },
  }),
  fineTune: dt('Dopracuj wygląd'),
  modeOption: dt('{mode:enum}', {
    enum: { mode: { system: 'Systemowy', dark: 'Ciemny', light: 'Jasny', oled: 'OLED' } },
  }),
  densityOption: dt('{density:enum}', {
    enum: { density: { comfortable: 'Wygodna', compact: 'Kompaktowa' } },
  }),
  ...settingsRows,
  groupDescription: dt('{group:enum}', {
    enum: {
      group: {
        typography: 'Krój pisma nagłówków i tekstu.',
        fontSize: 'Jak duży jest tekst.',
        spacing: 'Odstępy między elementami i wewnątrz nich.',
        sizing: 'Rozmiar kontrolek, ikon i awatarów.',
        radius: 'Jak bardzo zaokrąglone są przyciski i karty.',
        border: 'Jak grube są separatory i obrysy.',
        shadow: 'Jak wysoko karty i menu unoszą się nad stroną.',
        ambient: 'Delikatna poświata wokół odtwarzacza.',
        motion: 'Jak szybko i jak łagodnie poruszają się elementy.',
      },
    },
  }),
  themeDefault: dt('Domyślne motywu ({name})'),
  changed: dt('Zmieniono'),
  reset: dt('Resetuj'),
  resetGroup: dt('Przywróć domyślne motywu: {row}'),
  resetAll: dt('Przywróć wszystkie domyślne motywu'),
  nothingChanged: dt('Wszystko podąża za motywem.'),
  previewTitle: dt('Podgląd'),
  previewShelf: dt('Następne'),
  previewVideo: dt('Spacer po starym mieście'),
  previewChannel: dt('Wandering Lines'),
  previewMeta: dt('12 tys. wyświetleń, 2 dni temu'),
  previewSubscribe: dt('Subskrybuj'),
  previewText: dt('Zażółć gęślą jaźń, a szybki brązowy lis przeskoczył leniwego psa.'),
  previewButton: dt('Przycisk'),
  previewCard: dt('Karta'),
  accentOwn: dt('Użyj akcentu motywu'),
  accentPick: dt('Wybierz kolor'),
  accentUse: dt('Użyj tego akcentu'),
  accentPicked: dt('Wybrano {hex}'),
  accentAdjusted: dt('Dostosowano do {hex}, aby tekst na nim pozostał czytelny'),
  accentFits: dt('Czytelny w wybranej postaci'),
  accentRole: dt('{role:enum}', {
    enum: {
      role: {
        accent: 'Akcent',
        accentHover: 'Po najechaniu',
        accentSoft: 'Łagodny',
        onAccent: 'Tekst na akcencie',
        accentInk: 'Tekst akcentu',
      },
    },
  }),
  accentContrast: dt('{ratio:number}:1', { number: { ratio: { maximumFractionDigits: 1 } } }),
  accentFamily: dt('Widok w trybie: {mode}'),
  fineTuneHint: dt('Każdy zestaw tokenów, po jednej kontrolce.'),
  systemMotion: dt(
    'Twój system prosi o ograniczenie ruchu i to ustawienie zawsze ma pierwszeństwo.'
  ),
  contrastMore: dt('Większy kontrast'),
  captionLanguage: dt('{language:enum}', {
    enum: {
      language: {
        auto: 'Język filmu',
        en: 'Angielski',
        es: 'Hiszpański',
        fr: 'Francuski',
        de: 'Niemiecki',
        it: 'Włoski',
        pt: 'Portugalski',
        pl: 'Polski',
        ja: 'Japoński',
        ko: 'Koreański',
      },
    },
  }),
  followBrowser: dt('Zgodnie z przeglądarką'),
  followBrowserIn: dt('Zgodnie z przeglądarką ({name})'),
  clearHistoryAction: dt('Wyczyść historię'),
  clearHistoryTitle: dt('Wyczyścić historię oglądania?'),
  clearHistoryBody: dt(
    'Wszystkie filmy znikną z historii, a punkty wznowienia zostaną zapomniane. Tej operacji nie można cofnąć.'
  ),
  clearHistoryDone: dt('Historia oglądania wyczyszczona'),
  clearHistoryFailed: dt('Nie udało się wyczyścić historii oglądania'),
  hiddenEmpty: dt(
    'Nic nie jest ukryte. Wybierz Nie interesuje mnie to przy polecanym filmie, aby go ukryć.'
  ),
  hiddenChannel: dt('Kanał: {name}'),
  hiddenVideoUnavailable: dt('Film, który nie jest już dostępny'),
  hiddenUndo: dt('Cofnij'),
  hiddenUndoLabel: dt('Cofnij ukrycie: {name}'),
  hiddenLoadMore: dt('Pokaż więcej'),
  hiddenFailed: dt('Nie udało się wczytać ukrytych elementów'),
  signInTitle: dt('Zaloguj się, aby zmieniać te ustawienia'),
  signInDescription: dt('Są zapisane na Twoim koncie, więc będą z Tobą na kolejnym urządzeniu.'),
  signIn: dt('Zaloguj się'),
  notSaved: dt('Nie zapisano na Twoim koncie'),
  saveFailed: dt('Nie udało się zapisać Twoich ustawień'),
  saveFailedDescription: dt('Zmiana została zachowana na tym urządzeniu.'),
  retry: dt('Spróbuj ponownie'),
  sectionTitle: dt('{section:enum}', {
    enum: {
      section: {
        appearance: 'Wygląd',
        advanced: 'Dopracuj wygląd',
        accessibility: 'Dostępność',
        playback: 'Odtwarzanie',
        privacy: 'Prywatność',
        notifications: 'Powiadomienia',
        language: 'Język',
      },
    },
  }),
  sectionSummary: dt('{section:enum}', {
    enum: {
      section: {
        appearance: 'Motyw, tryb, akcent i gęstość',
        advanced: 'Każdy zestaw tokenów, po jednej kontrolce',
        accessibility: 'Rozmiar tekstu, kontrast, ruch i napisy',
        playback: 'Jakość, szybkość, autoodtwarzanie i podglądy',
        privacy: 'Historia i to, co widzą inni',
        notifications: 'Filmy, odpowiedzi i przetwarzanie',
        language: 'Język, w którym czytasz Taitube',
      },
    },
  }),
} as const;
