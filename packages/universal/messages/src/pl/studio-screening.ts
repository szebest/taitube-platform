import { dt } from '../define';

export const studioScreening = {
  adminTabScreening: dt('Wstrzymane i oflagowane'),
  screeningTitle: dt('Wstrzymane i oflagowane'),
  screeningIntro: dt(
    'Filmy, które automatyczna kontrola wstrzymała lub oflagowała. Wynik to materiał dla człowieka, nigdy wyrok.'
  ),
  screeningCaption: dt('Wstrzymane i oflagowane filmy, najpierw otwarte sprawy'),
  screeningFilter: dt('Pokaż'),
  screeningFilterOption: dt('{state:enum}', {
    enum: { state: { open: 'Otwarte', decided: 'Rozstrzygnięte' } },
  }),
  screeningColVideo: dt('Film'),
  screeningColScore: dt('Wynik'),
  screeningColReasons: dt('Powody'),
  screeningColMatch: dt('Dopasowany film'),
  screeningColState: dt('Stan'),
  screeningColCreated: dt('Sprawdzono'),
  screeningColActions: dt('Działania'),
  screeningReasonName: dt('{reason:enum}', {
    enum: {
      reason: {
        DUPLICATE: 'Duplikat innego filmu',
        PARTIAL_MATCH: 'Częściowe dopasowanie',
        KNOWN_REJECTED: 'Pasuje do odrzuconego filmu',
        NSFW: 'Treści dla dorosłych',
        BLANK: 'Pusty lub zatrzymany film',
        METADATA_SPAM: 'Spam w tekście',
        SCREEN_ERROR: 'Kontrola się nie powiodła',
      },
    },
  }),
  screeningStateName: dt('{state:enum}', {
    enum: {
      state: {
        held: 'Wstrzymany',
        flagged: 'Oflagowany',
        appealed: 'Odwołanie',
        approved: 'Zatwierdzony',
        rejected: 'Odrzucony',
        dismissed: 'Odrzucone flagi',
      },
    },
  }),
  screeningMatchNone: dt('Brak dopasowanego filmu'),
  screeningMatchLine: dt('{title} na kanale {channel}'),
  screeningMatchGone: dt('Film, którego już nie ma'),
  screeningRange: dt('od {from} do {to}'),
  screeningEvidence: dt('Dowody'),
  screeningEvidenceFor: dt('Dowody: {title}'),
  screeningEvidenceDescription: dt(
    'Co znalazła kontrola, osobny blok dla każdego powodu. Przed decyzją obejrzyj klatki i dopasowany film.'
  ),
  screeningLimitsTitle: dt('Czego dopasowanie nie wykrywa'),
  screeningLimits: dt(
    'Porównuje tylko z katalogiem tej platformy, nigdy z innymi serwisami. Radzi sobie z ponownym kodowaniem, skalowaniem, zmianą bitrate, przycięciem w czasie, małymi nakładkami i odbiciem lustrzanym. Nie wykrywa mocnego kadrowania, zmiany tempa ani nagrania ekranu.'
  ),
  screeningFindingScore: dt('Wynik {score}'),
  screeningMatchedVideo: dt('Dopasowany film'),
  screeningSameChannel: dt('Ten sam kanał, więc tylko informacyjnie'),
  screeningMirrored: dt('Odbicie lustrzane'),
  screeningCoverageVideo: dt('Zgodność obrazu {value}'),
  screeningCoverageAudio: dt('Zgodność dźwięku {value}'),
  screeningSourceRange: dt('W tym filmie: {range}'),
  screeningMatchedRange: dt('W dopasowanym filmie: {range}'),
  screeningFrames: dt('Oflagowane klatki'),
  screeningFrameAt: dt('Klatka w {time}, wynik {score}'),
  screeningFlaggedShare: dt('Próbkowane klatki powyżej progu: {share}'),
  screeningSignals: dt('Trafienia w metadanych'),
  screeningProfanity: dt('Dopasowane słowa'),
  screeningAppealHeading: dt('Odwołanie twórcy'),
  screeningDecisionNote: dt('Podany powód: {note}'),
  screeningApprove: dt('Zatwierdź'),
  screeningApproveFor: dt('Zatwierdź: {title}'),
  screeningReject: dt('Odrzuć'),
  screeningRejectFor: dt('Odrzuć: {title}'),
  screeningDismiss: dt('Odrzuć flagi'),
  screeningDismissFor: dt('Odrzuć flagi filmu {title}'),
  screeningRejectTitle: dt('Odrzucić film {title}?'),
  screeningRejectDescription: dt(
    'Twórca przeczyta Twój powód i może się odwołać. Odwołanie rozstrzyga inny moderator.'
  ),
  screeningRejectReason: dt('Powód'),
  screeningRejectReasonHint: dt('Twórca to przeczyta. Wymagane, najwyżej 500 znaków.'),
  screeningEmptyTitle: dt('Nic nie jest wstrzymane ani oflagowane'),
  screeningEmptyDescription: dt(
    'Tu pojawiają się filmy, które automatyczna kontrola wstrzymała lub oflagowała.'
  ),
  screeningFailed: dt('Nie udało się wczytać wstrzymanych i oflagowanych filmów.'),
  screeningActionFailed: dt('Nie zapisano decyzji.'),
  screeningConflict: dt('Film zmienił się w trakcie decyzji. Lista została odświeżona.'),
  creatorScreeningHeldTitle: dt('Ten film jest wstrzymany'),
  creatorScreeningHeldBody: dt(
    'Zanim film zostanie opublikowany, musi go obejrzeć recenzent. Decyzję dostaniesz w powiadomieniu.'
  ),
  creatorScreeningRejectedTitle: dt('Recenzent odrzucił ten film'),
  creatorScreeningReason: dt('{reason:enum}', {
    enum: {
      reason: {
        DUPLICATE: 'Wygląda na kopię filmu, który już jest w Taitube.',
        NSFW: 'Wygląda na to, że zawiera treści dla dorosłych.',
        BLANK: 'Wygląda na pusty lub zatrzymany.',
        METADATA_SPAM: 'Tytuł, opis lub tagi wyglądają na spam.',
        SCREEN_ERROR: 'Automatyczna kontrola nie mogła się zakończyć.',
      },
    },
  }),
  creatorScreeningNote: dt('Recenzent napisał: {note}'),
  creatorScreeningAppealSent: dt('Twoje odwołanie: {message}'),
  creatorScreeningAppealWaiting: dt('Rozstrzygnie je inny recenzent.'),
  creatorScreeningAppealDecided: dt('Twoje odwołanie zostało rozstrzygnięte.'),
  creatorScreeningAppealLabel: dt('Dlaczego to pomyłka?'),
  creatorScreeningAppealHint: dt('Najwyżej 1000 znaków.'),
  creatorScreeningAppealSubmit: dt('Wyślij odwołanie'),
  creatorScreeningAppealFailed: dt('Nie wysłano odwołania.'),
  creatorScreeningFailed: dt('Nie udało się wczytać powodu wstrzymania filmu.'),
} as const;
