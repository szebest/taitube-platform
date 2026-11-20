import { dt } from '../engine';
import { studioDevelopersTokens } from './studio-developers-tokens';

export const studioDevelopers = {
  ...studioDevelopersTokens,
  developersNav: dt('Dla programistów'),
  developersTitle: dt('Dla programistów'),
  developersDescription: dt(
    'Tokeny dla Twoich skryptów, webhooki, które mówią im, co się stało, i dane kanału do zabrania.'
  ),
  secretDone: dt('Gotowe'),
  webhooksTitle: dt('Webhooki'),
  webhooksDescription: dt(
    'Gdy coś się wydarzy, wysyłamy na Twój adres żądanie POST z podpisanym JSON-em. Sprawdzaj X-Taitube-Signature-256 sekretem.'
  ),
  webhooksCaption: dt('Twoje webhooki'),
  webhooksCreate: dt('Dodaj webhook'),
  webhooksColumnUrl: dt('Adres'),
  webhooksColumnEvents: dt('Zdarzenia'),
  webhooksColumnCreated: dt('Dodano'),
  webhooksColumnActions: dt('Akcje'),
  webhookEvent: dt('{event:enum}', {
    enum: {
      event: {
        'video.ready': 'Film gotowy',
        'live.started': 'Transmisja rozpoczęta',
        'export.ready': 'Eksport gotowy',
        'comment.held': 'Komentarz wstrzymany',
      },
    },
  }),
  webhookEventHint: dt('{event:enum}', {
    enum: {
      event: {
        'video.ready': 'Film się przetworzył i jest opublikowany.',
        'live.started': 'Zarezerwowane: na razie nic go nie wysyła.',
        'export.ready': 'Eksport kanału można pobrać.',
        'comment.held': 'Komentarz czeka na przegląd. Same identyfikatory, nigdy treść.',
      },
    },
  }),
  webhooksSendTest: dt('Wyślij test'),
  webhooksSendTestLabel: dt('Wyślij test na {url}'),
  webhooksTestDelivered: dt('Test dostarczony na {url}'),
  webhooksTestRefused: dt('Test nie dotarł na {url}'),
  webhooksTestReason: dt('{reason:enum}', {
    enum: {
      reason: {
        timeout: 'Odbiorca nie odpowiedział w pięć sekund.',
        network: 'Nie udało się połączyć z odbiorcą.',
        status: 'Odbiorca odpowiedział błędem.',
        'blocked-host': 'Ten host jest niedozwolony.',
        redirect: 'Odbiorca odpowiedział przekierowaniem, za którym nie podążamy.',
      },
    },
  }),
  webhooksTestStatus: dt('Odpowiedział kodem {status:number}.'),
  webhooksTestFailed: dt('Nie udało się wysłać testu.'),
  webhooksDelete: dt('Usuń {url}'),
  webhooksDeleteTitle: dt('Usunąć ten webhook?'),
  webhooksDeleteDescription: dt('Wysyłka na {url} ustanie od razu.'),
  webhooksDeleteConfirm: dt('Usuń'),
  webhooksDeleted: dt('Webhook usunięty'),
  webhooksDeleteFailed: dt('Nie udało się usunąć webhooka.'),
  webhooksEmptyTitle: dt('Nie masz jeszcze webhooków'),
  webhooksEmptyDescription: dt(
    'Dodaj webhook, aby dowiadywać się o nowych filmach, gotowych eksportach i wstrzymanych komentarzach.'
  ),
  webhooksFailed: dt('Nie udało się wczytać webhooków.'),
  webhookDialogTitle: dt('Dodaj webhook'),
  webhookDialogDescription: dt('Wybierz zdarzenia, które obsługuje Twój odbiorca.'),
  webhookUrl: dt('Adres odbiorcy'),
  webhookUrlHint: dt('Tylko https, na publicznym hoście, bez nazwy użytkownika i hasła.'),
  webhookUrlRequired: dt('Podaj adres odbiorcy.'),
  webhookEvents: dt('Zdarzenia'),
  webhookEventsRequired: dt('Wybierz co najmniej jedno zdarzenie.'),
  webhookCreateSubmit: dt('Dodaj webhook'),
  webhookCreateFailed: dt('Nie udało się dodać webhooka.'),
  webhookCreatedTitle: dt('Skopiuj sekret podpisu'),
  webhookSecretNotice: dt(
    'Sekret jest pokazywany tylko teraz. Odbiorca potrzebuje go, aby sprawdzać podpis każdego zdarzenia.'
  ),
  webhookSecretLabel: dt('Sekret podpisu'),
  webhookSecretSaved: dt('Zapisałem sekret w bezpiecznym miejscu'),
  exportsTitle: dt('Eksporty'),
  exportsDescription: dt(
    'Statystyki, komentarze i szczegóły filmów jako CSV lub JSON. Plik jest przechowywany przez {days:number} dni.'
  ),
  exportsCaption: dt('Eksporty kanału'),
  exportsRequest: dt('Zamów eksport'),
  exportsColumnKind: dt('Dane'),
  exportsColumnRange: dt('Zakres'),
  exportsColumnStatus: dt('Stan'),
  exportsColumnRequested: dt('Zamówiono'),
  exportsColumnActions: dt('Akcje'),
  exportKind: dt('{kind:enum}', {
    enum: {
      kind: {
        video_analytics: 'Statystyki filmów',
        channel_analytics: 'Statystyki kanału',
        comments: 'Komentarze',
        videos: 'Filmy',
      },
    },
  }),
  exportFormat: dt('{format:enum}', { enum: { format: { csv: 'CSV', json: 'JSON' } } }),
  exportRangeAll: dt('Wszystko'),
  exportRangeFrom: dt('Od {from}'),
  exportRangeTo: dt('Do {to}'),
  exportRangeBetween: dt('{from} do {to}'),
  exportStatus: dt('{status:enum}', {
    enum: {
      status: {
        queued: 'W kolejce',
        running: 'Zapisywanie',
        ready: 'Gotowy',
        failed: 'Nieudany',
        expired: 'Wygasł',
      },
    },
  }),
  exportRows: dt('{count:plural}', {
    plural: {
      count: { one: '{?} wiersz', few: '{?} wiersze', many: '{?} wierszy', other: '{?} wiersza' },
    },
  }),
  exportsDownload: dt('Pobierz'),
  exportsDownloadLabel: dt('Pobierz eksport: {kind}'),
  exportsDownloadFailed: dt('Nie udało się pobrać pliku.'),
  exportsDelete: dt('Usuń eksport: {kind}'),
  exportsDeleted: dt('Eksport usunięty'),
  exportsDeleteFailed: dt('Nie udało się usunąć eksportu.'),
  exportsReady: dt('Eksport gotowy: {kind}'),
  exportsFailedEvent: dt('Eksport nieudany: {kind}'),
  exportsEmptyTitle: dt('Nie masz jeszcze eksportów'),
  exportsEmptyDescription: dt('Zamów eksport, aby przenieść dane do arkusza.'),
  exportsFailed: dt('Nie udało się wczytać eksportów.'),
  exportDialogTitle: dt('Zamów eksport'),
  exportDialogDescription: dt(
    'Naraz trwa jeden eksport, {perDay:number} dziennie. Ta strona powie, gdy plik będzie gotowy.'
  ),
  exportKindLabel: dt('Dane'),
  exportFormatLabel: dt('Format'),
  exportRangeLabel: dt('Zakres'),
  exportRangeOption: dt('{range:enum}', {
    enum: {
      range: {
        '7d': 'Ostatnie 7 dni',
        '30d': 'Ostatnie 30 dni',
        '90d': 'Ostatnie 90 dni',
        lifetime: 'Wszystko',
      },
    },
  }),
  exportRequestSubmit: dt('Zamów eksport'),
  exportRequested: dt('Eksport zamówiony'),
  exportRequestFailed: dt('Nie udało się zamówić eksportu.'),
  referenceTitle: dt('Dokumentacja API'),
  referenceDescription: dt(
    'Każda ścieżka, potrzebny jej zakres i jej błędy są w dokumencie OpenAPI. Każdy przykład niżej czyta token ze zmiennej TAITUBE_TOKEN.'
  ),
  referenceDocument: dt('Dokument OpenAPI'),
  referenceBrowse: dt('Przeglądaj dokumentację'),
  referenceExamples: dt('Przykłady według zakresu'),
  referenceCopyExample: dt('Kopiuj curl dla {scope}'),
  referenceExampleLabel: dt('curl dla {scope}'),
};
