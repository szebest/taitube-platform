import { dt } from '../define';

export const studioAdmin = {
  adminNav: dt('Admin'),
  adminTabs: dt('Sekcje panelu admina'),
  adminTabCategories: dt('Kategorie'),
  adminTabModeration: dt('Moderacja'),
  adminTabQueues: dt('Kolejki'),
  adminDeniedTitle: dt('Brak dostępu'),
  adminDeniedDescription: dt('Panel admina jest przeznaczony dla administratorów.'),
  adminCategoriesCaption: dt('Kategorie'),
  adminCategoryOrder: dt('Kolejność'),
  adminCategoryName: dt('Nazwa'),
  adminCategorySlug: dt('Slug'),
  adminCategoryVideos: dt('Filmy'),
  adminCategoryActive: dt('Aktywna'),
  adminCategoryActions: dt('Działania'),
  adminCategoryToggle: dt('Aktywna: {name}'),
  adminCategoryNew: dt('Nowa kategoria'),
  adminCategoryReorder: dt('Zmień kolejność'),
  adminCategoryEdit: dt('Edytuj: {name}'),
  adminCategoryDelete: dt('Usuń: {name}'),
  adminCategoriesEmptyTitle: dt('Brak kategorii'),
  adminCategoriesEmptyDescription: dt(
    'Utwórz pierwszą, aby widzowie mogli przeglądać filmy według tematu.'
  ),
  adminCategoriesFailed: dt('Nie udało się wczytać kategorii.'),
  adminCategoryCreateTitle: dt('Nowa kategoria'),
  adminCategoryEditTitle: dt('Edytuj kategorię'),
  adminCategoryDialogDescription: dt('Widzowie widzą nazwę na pasku kategorii w przeglądaniu.'),
  adminCategoryDescription: dt('Opis'),
  adminCategorySlugHint: dt('Małe litery, cyfry i myślniki.'),
  adminCategorySlugTaken: dt('Inna kategoria używa już tego sluga.'),
  adminCategorySaveFailed: dt('Nie zapisano kategorii.'),
  adminCategoryDeleteTitle: dt('Usunąć kategorię {name}?'),
  adminCategoryDeleteDescription: dt(
    'Kategoria {name} zostanie usunięta na stałe, a widzowie nie zobaczą jej już w przeglądaniu.'
  ),
  adminCategoryInUseTitle: dt('Nie można usunąć kategorii {name}'),
  adminCategoryInUseDescription: dt(
    'Kategoria {name} jest używana w {count:plural}. Kategorii z filmami nie można usunąć. Dezaktywuj ją: jej filmy nadal działają, a widzowie przestają ją widzieć w przeglądaniu.',
    {
      plural: {
        count: {
          one: '{?} filmie',
          few: '{?} filmach',
          many: '{?} filmach',
          other: '{?} filmach',
        },
      },
    }
  ),
  adminCategoryDeactivate: dt('Dezaktywuj'),
  adminCategoryDeleteFailed: dt('Nie usunięto kategorii.'),
  adminCategoryReorderTitle: dt('Zmień kolejność kategorii'),
  adminCategoryReorderDescription: dt(
    'Ustaw fokus na uchwycie i naciśnij spację, aby podnieść kategorię, strzałki, aby ją przesunąć, i spację, aby ją upuścić. Kolejność zapisuje się po upuszczeniu.'
  ),
  adminCategoryReorderFailed: dt('Nie zapisano nowej kolejności.'),
  adminFilterStatus: dt('Status'),
  adminFilterVisibility: dt('Widoczność'),
  adminFilterCategory: dt('Kategoria'),
  adminFilterAll: dt('Wszystkie'),
  adminFiltersClear: dt('Wyczyść filtry'),
  adminLoadMore: dt('Wczytaj więcej'),
  adminVideosTitle: dt('Filmy'),
  adminVideosCaption: dt('Wszystkie filmy'),
  adminVideosSearch: dt('Szukaj tytułów'),
  adminVideosSearchAction: dt('Szukaj'),
  adminVideoTitle: dt('Tytuł'),
  adminVideoChannel: dt('Kanał'),
  adminVideoStatus: dt('Status'),
  adminVideoVisibility: dt('Widoczność'),
  adminVideoViews: dt('Wyświetlenia'),
  adminVideoLikes: dt('Polubienia'),
  adminVideoUploaded: dt('Przesłano'),
  adminVideoActions: dt('Działania'),
  adminVideoForcePrivate: dt('Wymuś prywatność'),
  adminVideoReject: dt('Odrzuć'),
  adminVideoDelete: dt('Usuń'),
  adminVideosEmptyTitle: dt('Brak filmów do pokazania'),
  adminVideosEmptyDescription: dt('Filmy pojawią się tutaj, gdy twórcy je prześlą.'),
  adminVideosFailed: dt('Nie udało się wczytać filmów.'),
  adminForcePrivateTitle: dt('Ustawić film {title} jako prywatny?'),
  adminForcePrivateDescription: dt(
    'Film {title} natychmiast przestaje być dostępny dla widzów. Jego właściciel może ponownie ustawić go jako publiczny.'
  ),
  adminRejectTitle: dt('Odrzucić film {title}?'),
  adminRejectDescription: dt(
    'Film {title} zostaje usunięty z obiegu: staje się prywatny i odrzucony, a jego właściciel nie może go ponownie opublikować.'
  ),
  adminRejectReason: dt('Powód'),
  adminRejectReasonHint: dt('Zachowany razem z usunięciem. Wymagany, najwyżej 500 znaków.'),
  adminDeleteVideoTitle: dt('Usunąć film {title}?'),
  adminDeleteVideoDescription: dt(
    'Film {title} zostanie usunięty na stałe. Widzowie go stracą, a jego pliki zostaną wyczyszczone.'
  ),
  adminVideoActionFailed: dt('Nie zapisano zmiany.'),
  adminVideoConflict: dt(
    'Film zmienił się od wczytania tej listy. Lista została odświeżona, spróbuj ponownie.'
  ),
  adminReportsTitle: dt('Zgłoszone komentarze'),
  adminReportsCaption: dt('Zgłoszone komentarze'),
  adminReportComment: dt('Komentarz'),
  adminReportReason: dt('Powód'),
  adminReportNote: dt('Notatka'),
  adminReportStatus: dt('Status'),
  adminReportReported: dt('Zgłoszono'),
  adminReportActions: dt('Działania'),
  adminReportReasonName: dt('{reason:enum}', {
    enum: {
      reason: {
        spam: 'Spam',
        harassment: 'Nękanie',
        hate: 'Mowa nienawiści',
        misinformation: 'Dezinformacja',
        other: 'Inne',
      },
    },
  }),
  adminReportState: dt('{state:enum}', {
    enum: { state: { open: 'Otwarte', removed: 'Usunięte', dismissed: 'Odrzucone' } },
  }),
  adminReportDismiss: dt('Odrzuć'),
  adminReportDismissFor: dt('Odrzuć zgłoszenie komentarza {comment}'),
  adminReportRemove: dt('Usuń'),
  adminReportRemoveFor: dt('Usuń komentarz {comment}'),
  adminReportRemoveTitle: dt('Usunąć ten komentarz?'),
  adminReportRemoveDescription: dt(
    'Komentarz {comment} zostanie usunięty razem z odpowiedziami, a wszystkie otwarte zgłoszenia dotyczące niego zostaną zamknięte.'
  ),
  adminReportsEmptyTitle: dt('Brak zgłoszonych komentarzy'),
  adminReportsEmptyDescription: dt('Komentarze zgłoszone przez widzów pojawią się tutaj.'),
  adminReportsFailed: dt('Nie udało się wczytać zgłoszeń.'),
  adminReportResolveFailed: dt('Nie rozpatrzono zgłoszenia.'),
  adminQueuesBullBoard: dt('Otwórz Bull Board'),
  adminQueuesBullBoardHint: dt(
    'Głębokość każdej kolejki, zadania i ponowienia znajdziesz w Bull Board.'
  ),
  adminDlqParked: dt('Zaparkowane zadania'),
  adminDlqCount: dt('{count:number}'),
  adminDlqCountMore: dt('{count:number}+'),
  adminDlqTitle: dt('Kolejka martwych zadań'),
  adminDlqCaption: dt('Martwe zadania'),
  adminDlqQueue: dt('Kolejka'),
  adminDlqJob: dt('Zadanie'),
  adminDlqError: dt('Błąd'),
  adminDlqAttempts: dt('Próby'),
  adminDlqStatus: dt('Status'),
  adminDlqStatusName: dt('{status:enum}', {
    enum: { status: { PARKED: 'Zaparkowane', REPLAYED: 'Powtórzone', DISCARDED: 'Odrzucone' } },
  }),
  adminDlqFailedAt: dt('Niepowodzenie'),
  adminDlqActions: dt('Działania'),
  adminDlqReplay: dt('Powtórz'),
  adminDlqReplayFor: dt('Powtórz zadanie {job}'),
  adminDlqDiscard: dt('Odrzuć'),
  adminDlqDiscardFor: dt('Odrzuć zadanie {job}'),
  adminDlqReplayTitle: dt('Powtórzyć zadanie {job}?'),
  adminDlqReplayDescription: dt('Zadanie wraca do kolejki {queue} i uruchamia się ponownie.'),
  adminDlqDiscardTitle: dt('Odrzucić zadanie {job}?'),
  adminDlqDiscardDescription: dt(
    'Zadanie {job} zostanie oznaczone jako odrzucone i nie uruchomi się ponownie. Tej operacji nie można cofnąć.'
  ),
  adminDlqEmptyTitle: dt('Nic nie zawiodło'),
  adminDlqEmptyDescription: dt('Zadania, którym skończą się ponowienia, trafiają tutaj.'),
  adminDlqFailed: dt('Nie udało się wczytać kolejki martwych zadań.'),
  adminDlqActionFailed: dt('Nie zaktualizowano zadania.'),
} as const;
