import { dt } from '../define';

export const studioCommentSettings = {
  settingsTitle: dt('Ustawienia komentarzy'),
  settingsLink: dt('Ustawienia komentarzy'),
  settingsForbidden: dt('Te ustawienia zmieniają tylko właściciel i menedżerowie.'),
  settingsReviewTitle: dt('Przegląd'),
  settingsReviewDescription: dt(
    'Wstrzymuj komentarze do przejrzenia, zanim ktokolwiek je zobaczy.'
  ),
  settingsReviewLabel: dt('Wstrzymuj'),
  settingsReviewOption: dt('{mode:enum}', {
    enum: { mode: { none: 'Nic', links: 'Linki', all: 'Wszystko' } },
  }),
  settingsBlockedTitle: dt('Zablokowane słowa'),
  settingsBlockedDescription: dt(
    'Komentarz z jednym z tych słów jest wstrzymywany, bez względu na wielkość liter i akcenty.'
  ),
  settingsBlockedLabel: dt('Zablokowane słowa'),
  settingsBlockedPlaceholder: dt('Dodaj słowo i naciśnij Enter'),
  settingsAllowlistTitle: dt('Dozwolone linki'),
  settingsAllowlistDescription: dt('Linki do tych stron i ich subdomen nie są wstrzymywane.'),
  settingsAllowlistLabel: dt('Dozwolone strony'),
  settingsAllowlistPlaceholder: dt('example.com'),
  settingsSlowTitle: dt('Tryb spowolnienia'),
  settingsSlowDescription: dt(
    'Jak długo widz czeka między komentarzami. Odpowiedzi też się liczą.'
  ),
  settingsSlowLabel: dt('Czas między komentarzami'),
  settingsSlowOption: dt('{seconds:enum}', {
    enum: {
      seconds: {
        off: 'Wyłączony',
        '5': '5 sekund',
        '10': '10 sekund',
        '30': '30 sekund',
        '60': '1 minuta',
        '300': '5 minut',
      },
    },
  }),
  settingsSubscribersTitle: dt('Tylko subskrybenci'),
  settingsSubscribersDescription: dt('Komentować mogą tylko osoby subskrybujące Twój kanał.'),
  settingsSubscribersLabel: dt('Komentować mogą tylko subskrybenci'),
  settingsAgeTitle: dt('Wiek konta'),
  settingsAgeDescription: dt('Nowe konto czeka tyle, zanim będzie mogło komentować.'),
  settingsAgeLabel: dt('Minimalny wiek konta'),
  settingsAgeOption: dt('{days:enum}', {
    enum: {
      days: {
        '0': 'Bez minimum',
        '1': '1 dzień',
        '3': '3 dni',
        '7': '7 dni',
        '14': '14 dni',
        '30': '30 dni',
      },
    },
  }),
  settingsDefaultsTitle: dt('Co dowiaduje się autor'),
  settingsDefaultsDescription: dt(
    'Dla każdego działania wybierz, czy autor widzi, co się stało. Moderator może to zmienić przy jednym komentarzu.'
  ),
  settingsDefaultRule: dt('{rule:enum}', {
    enum: {
      rule: {
        hide: 'Ukrycie',
        remove: 'Usunięcie',
        manual_hold: 'Wstrzymanie przez moderatora',
        'auto.blocked_words': 'Wstrzymanie za zablokowane słowo',
        'auto.links': 'Wstrzymanie za link',
        'auto.review_all': 'Wstrzymanie w trybie przeglądu',
      },
    },
  }),
  settingsDefaultSeen: dt('{seen:enum}', {
    enum: {
      seen: {
        hold_silent: 'Autor widzi komentarz jako opublikowany.',
        hold_visible: 'Autor widzi, że komentarz czeka na przejrzenie.',
        hide_silent: 'Autor widzi komentarz jak zwykle.',
        hide_visible: 'Autor widzi komentarz jako ukryty, z powodem.',
        remove_silent: 'Autor nie dowiaduje się o niczym.',
        remove_visible: 'Autor dostaje powód i powiadomienie.',
      },
    },
  }),
  settingsTrustedTitle: dt('Zaufani komentujący'),
  settingsTrustedDescription: dt(
    'Omijają automatyczne wstrzymania, tryb spowolnienia i sprawdzanie wieku konta. Zaufaj komuś ze skrzynki.'
  ),
  settingsTrustedEmpty: dt('Nikt nie jest jeszcze zaufany.'),
  settingsRemove: dt('Usuń'),
  settingsTrustedRemove: dt('Przestań ufać: {name}'),
  settingsTrustedFailed: dt('Nie udało się wczytać zaufanych komentujących.'),
  settingsRestrictionsTitle: dt('Ograniczenia'),
  settingsRestrictionsDescription: dt('Bany i ciche bany na Twoim kanale.'),
  settingsRestrictionsEmpty: dt('Nikt nie jest ograniczony.'),
  settingsRestrictionsFailed: dt('Nie udało się wczytać ograniczeń.'),
  settingsRestrictionKind: dt('{kind:enum}', {
    enum: { kind: { shadow: 'Cichy ban', ban: 'Ban' } },
  }),
  settingsRestrictionUntil: dt('Do {date}'),
  settingsRestrictionForever: dt('Do odwołania'),
  settingsRestrictionLift: dt('Zdejmij'),
  settingsRestrictionLiftLabel: dt('Zdejmij ograniczenie z: {name}'),
  settingsRestrictionLifted: dt('Ograniczenie zdjęte'),
  settingsRestrictionLiftFailed: dt('Nie udało się zdjąć ograniczenia.'),
  settingsTrustAuthor: dt('Zaufaj autorowi'),
  settingsTrustAuthorDone: dt('Autor jest zaufany'),
  settingsTrustAuthorFailed: dt('Nie udało się zaufać autorowi.'),
  settingsRepliesTitle: dt('Zapisane odpowiedzi'),
  settingsRepliesDescription: dt('Odpowiedzi, których używasz w skrzynce, do 20.'),
  settingsRepliesEmpty: dt('Brak zapisanych odpowiedzi.'),
  settingsRepliesFailed: dt('Nie udało się wczytać zapisanych odpowiedzi.'),
  settingsReplyTitleLabel: dt('Tytuł'),
  settingsReplyBodyLabel: dt('Odpowiedź'),
  settingsReplyAdd: dt('Dodaj odpowiedź'),
  settingsReplySave: dt('Zapisz odpowiedź'),
  settingsReplyEdit: dt('Edytuj: {title}'),
  settingsReplyDelete: dt('Usuń: {title}'),
  settingsReplyFailed: dt('Nie udało się zapisać odpowiedzi.'),
  settingsReplyLimit: dt('Masz 20 zapisanych odpowiedzi. Usuń jedną, aby dodać kolejną.'),
  repliesPick: dt('Zapisane odpowiedzi'),
  repliesPickLabel: dt('Wstaw zapisaną odpowiedź'),
  repliesPickEmpty: dt('Brak zapisanych odpowiedzi.'),
} as const;
