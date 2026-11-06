import { dt } from '../define';

export const studioCaptions = {
  captionsDefaultTitle: dt('Napisy'),
  captionsDefaultDescription: dt(
    'Nowe filmy dostają napisy generowane automatycznie, jeśli ich własny przełącznik podąża za kanałem. Filmy, które już masz, nie dostają napisów z tego ustawienia.'
  ),
  captionsDefaultLabel: dt('Generuj napisy dla nowych filmów'),
  captionsTitle: dt('Napisy'),
  captionsDescription: dt('Generuj napisy, popraw ich tekst albo dodaj własny plik WebVTT.'),
  captionsLoadFailed: dt('Nie udało się wczytać napisów.'),
  captionsAutoLabel: dt('Napisy generowane automatycznie'),
  captionsAutoOn: dt('Włączone'),
  captionsAutoOff: dt('Wyłączone'),
  captionsAutoFollowOn: dt('Według ustawienia kanału (obecnie włączone)'),
  captionsAutoFollowOff: dt('Według ustawienia kanału (obecnie wyłączone)'),
  captionsSettingsFailed: dt('Nie udało się zapisać przełącznika napisów.'),
  captionsTracksLabel: dt('Ścieżki napisów'),
  captionsNoTracks: dt('Nie ma jeszcze żadnych ścieżek napisów.'),
  captionsLanguageUnknown: dt('Język nie został jeszcze wykryty'),
  captionsKind: dt('{kind:enum}', {
    enum: { kind: { auto: 'Automatyczne', edited: 'Poprawione', uploaded: 'Wgrane' } },
  }),
  captionsStatus: dt('{status:enum}', {
    enum: {
      status: { pending: 'Oczekuje', ready: 'Gotowe', failed: 'Nieudane', disabled: 'Wyłączone' },
    },
  }),
  captionsReasonNoAudio: dt('Ten film nie ma dźwięku, który można opisać napisami.'),
  captionsReasonLanguageTaken: dt('Ścieżka w wykrytym języku już istnieje.'),
  captionsReasonUnknown: dt('Generowanie napisów się nie powiodło.'),
  captionsEdit: dt('Edytuj napisy'),
  captionsReplace: dt('Zastąp plikiem .vtt'),
  captionsDelete: dt('Usuń ścieżkę'),
  captionsRetry: dt('Spróbuj ponownie'),
  captionsRegenerate: dt('Wygeneruj ponownie'),
  captionsGenerationStarted: dt('Generowanie napisów'),
  captionsActionFailed: dt('To się nie udało. Spróbuj ponownie.'),
  captionsAddTitle: dt('Dodaj ścieżkę'),
  captionsLanguageLabel: dt('Kod języka'),
  captionsLanguageHint: dt('Znacznik języka, na przykład pl lub pt-BR.'),
  captionsLanguageTaken: dt(
    'Ten film ma już ścieżkę ({language}). Użyj na niej opcji zastąpienia.'
  ),
  captionsChooseFile: dt('Wybierz plik .vtt'),
  captionsFileTooLarge: dt('Plik ma ponad 1 MiB.'),
  captionsUploadFailed: dt('Nie udało się wgrać pliku.'),
  captionsUploaded: dt('Ścieżka wgrana'),
  captionsEditorTitle: dt('Edytuj napisy ({language})'),
  captionsEditorDescription: dt('Zmień tekst dowolnego napisu. Czas pozostaje bez zmian.'),
  captionsEditorEmpty: dt('Ta ścieżka nie ma napisów.'),
  captionsEditorLoadFailed: dt('Nie udało się wczytać napisów.'),
  captionsCueLabel: dt('Napis {number}'),
  captionsEditorSave: dt('Zapisz napisy'),
  captionsEditorSaved: dt('Napisy zapisane'),
  captionsEditorFailed: dt('Nie udało się zapisać napisów.'),
  captionsDeleteTitle: dt('Usunąć tę ścieżkę?'),
  captionsDeleteBody: dt('Ścieżka i jej plik WebVTT zostaną usunięte.'),
  captionsDeleted: dt('Ścieżka usunięta'),
  captionsOverwriteTitle: dt('Zastąpić Twoje zmiany?'),
  captionsOverwriteBody: dt(
    'Ponowne wygenerowanie zastąpi napisy poprawione lub wgrane przez Ciebie.'
  ),
  captionsOverwriteConfirm: dt('Wygeneruj i zastąp'),
} as const;
