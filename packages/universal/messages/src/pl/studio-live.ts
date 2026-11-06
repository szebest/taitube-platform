import { dt } from '../define';

export const studioLive = {
  liveNav: dt('Na żywo'),
  liveTitle: dt('Na żywo'),
  liveUntitled: dt('Transmisja bez tytułu'),
  liveStatus: dt('{status:enum}', {
    enum: { status: { IDLE: 'Offline', LIVE: 'Na żywo', ENDED: 'Zakończona' } },
  }),
  liveLoadFailed: dt('Nie udało się wczytać Twojej transmisji.'),
  liveViewersLabel: dt('Widzowie teraz'),
  liveTimeLabel: dt('Czas transmisji'),
  liveChatModeLabel: dt('Tryb czatu'),
  liveChatAudience: dt('{audience:enum}', {
    enum: { audience: { everyone: 'Czatować może każdy', subscribers: 'Tylko subskrybenci' } },
  }),
  liveSlowModeOff: dt('Tryb powolny wyłączony'),
  liveSlowModeOn: dt('Tryb powolny: {seconds:plural}', {
    plural: {
      seconds: { one: '{?} sekunda', few: '{?} sekundy', many: '{?} sekund', other: '{?} sekundy' },
    },
  }),
  liveChartTitle: dt('Widzowie w trakcie transmisji'),
  liveChartSeries: dt('Widzowie'),
  liveChartColumnTime: dt('Czas'),
  liveChartColumnViewers: dt('Widzowie'),
  liveCredentialsTitle: dt('Połącz swój koder'),
  liveCredentialsDescription: dt(
    'Wklej adres serwera i klucz transmisji do OBS albo nadawaj z przeglądarki przez WHIP.'
  ),
  liveCredentialsWarning: dt(
    'Każdy, kto zna klucz transmisji, może nadawać na Twoim kanale. Nigdy nie pokazuj go na wizji.'
  ),
  liveRtmpUrl: dt('Adres serwera'),
  liveStreamKey: dt('Klucz transmisji'),
  liveWhipUrl: dt('Adres WHIP'),
  liveControlToken: dt('Token sterowania aplikacji towarzyszącej'),
  liveOverlaysTitle: dt('Źródła przeglądarkowe OBS'),
  liveOverlaysHint: dt('Dodaj każdy z nich w OBS jako źródło przeglądarkowe.'),
  liveOverlay: dt('Adres nakładki: {widget:enum}', {
    enum: { widget: { chat: 'czat', alerts: 'alerty', goal: 'cel subskrypcji' } },
  }),
  liveRevealField: dt('Pokaż: {label}'),
  liveHideField: dt('Ukryj: {label}'),
  liveCopyField: dt('Kopiuj: {label}'),
  liveCopied: dt('Skopiowano: {label}'),
  liveCopyFailed: dt('Nie udało się skopiować: {label}'),
  liveIdleLine: dt(
    'Nie nadajesz teraz. Rozpocznij transmisję w OBS, a ta strona przejdzie na żywo razem z Tobą.'
  ),
  liveEndedLine: dt(
    'Ta transmisja się zakończyła. Nagranie zostanie opublikowane po zakończeniu przetwarzania.'
  ),
  liveWatchRecording: dt('Obejrzyj nagranie'),
  liveChatTitle: dt('Czat'),
  liveChatOffline: dt('Czat otworzy się, gdy rozpoczniesz transmisję.'),
  liveChatEmpty: dt('Brak wiadomości.'),
  liveChatViewer: dt('Widz'),
  liveChatRemove: dt('Usuń wiadomość od: {author}'),
  liveChatRemoved: dt('Wiadomość usunięta'),
  liveChatConnection: dt('{connection:enum}', {
    enum: {
      connection: { connecting: 'Łączenie z czatem', closed: 'Czat rozłączony, łączę ponownie' },
    },
  }),
  liveChatModeTitle: dt('Tryb czatu'),
  liveChatModeDescription: dt('Tryb powolny ogranicza, jak często widz może pisać.'),
  liveSlowModeLabel: dt('Tryb powolny'),
  liveSlowModeSeconds: dt('{seconds:plural}', {
    plural: {
      seconds: { one: '{?} sekunda', few: '{?} sekundy', many: '{?} sekund', other: '{?} sekundy' },
    },
  }),
  liveSubscribersOnly: dt('Tylko subskrybenci'),
  liveChatModeSave: dt('Zapisz tryb czatu'),
  liveChatModeSaved: dt('Zapisano tryb czatu'),
  liveChatModeNotSaved: dt('Nie udało się zapisać trybu czatu'),
  liveStop: dt('Zakończ transmisję'),
  liveStopTitle: dt('Zakończyć transmisję?'),
  liveStopBody: dt(
    'Koder zostanie rozłączony, a transmisja zakończy się dla wszystkich widzów. Nagranie zostanie opublikowane po zakończeniu przetwarzania.'
  ),
  liveStopCancel: dt('Nadawaj dalej'),
  liveStopped: dt('Transmisja zakończona'),
  liveNotStopped: dt('Nie udało się zakończyć transmisji'),
  liveOverlayChatLabel: dt('Czat na żywo'),
  liveOverlayNewSubscriber: dt('Nowy subskrybent!'),
  liveOverlaySubscribers: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} subskrybent',
        few: '{?} subskrybentów',
        many: '{?} subskrybentów',
        other: '{?} subskrybentów',
      },
    },
  }),
  liveOverlayGoalLabel: dt('Cel subskrypcji'),
  liveOverlayGoalProgress: dt('{count:number} z {goal:number}'),
} as const;
