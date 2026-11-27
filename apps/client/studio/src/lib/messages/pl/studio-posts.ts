import { dt } from '@vp/shared-messages';

const KINDS = {
  text: 'Tekst',
  images: 'Zdjęcia',
  poll: 'Ankieta',
  quiz: 'Quiz',
  video_share: 'Film',
  playlist_share: 'Playlista',
} as const;

export const studioPosts = {
  postsNav: dt('Posty'),
  postsTitle: dt('Posty'),
  postsDescription: dt(
    'To, co mówisz subskrybentom poza filmem: słowa, zdjęcia, ankiety, quizy i propozycje, co obejrzeć dalej.'
  ),
  postsNew: dt('Nowy post'),
  postsFilter: dt('Pokaż posty'),
  postsFilterOption: dt('{filter:enum}', {
    enum: {
      filter: {
        all: 'Wszystkie',
        draft: 'Szkice',
        scheduled: 'Zaplanowane',
        published: 'Opublikowane',
      },
    },
  }),
  postsCaption: dt('Twoje posty, od najnowszych'),
  postsColumnKind: dt('Rodzaj'),
  postsColumnPost: dt('Post'),
  postsColumnStatus: dt('Stan'),
  postsColumnWhen: dt('Kiedy'),
  postsColumnComments: dt('Odpowiedzi'),
  postsColumnActions: dt('Działania'),
  postsKind: dt('{kind:enum}', { enum: { kind: KINDS } }),
  postsStatus: dt('{status:enum}', {
    enum: { status: { draft: 'Szkic', scheduled: 'Zaplanowany', published: 'Opublikowany' } },
  }),
  postsPinnedMarker: dt('Przypięty'),
  postsNoText: dt('Bez tekstu'),
  postsCommentsOff: dt('Wyłączone'),
  postsEmptyTitle: dt('Nie ma tu jeszcze postów'),
  postsEmptyBody: dt('Napisz pierwszy, aby dotrzeć do subskrybentów bez filmu.'),
  postsFailed: dt('Nie udało się wczytać Twoich postów.'),
  postsActions: dt('Działania dla: {title}'),
  postsEdit: dt('Edytuj'),
  postsPin: dt('Przypnij na górze'),
  postsUnpin: dt('Odepnij'),
  postsStats: dt('Statystyki'),
  postsDelete: dt('Usuń'),
  postsPinnedToast: dt('Post przypięty'),
  postsUnpinnedToast: dt('Post odpięty'),
  postsPinFailed: dt('Nie zmieniono przypięcia.'),
  postsDeleted: dt('Post usunięty'),
  postsDeleteFailed: dt('Nie udało się usunąć posta.'),
  postsDeleteTitle: dt('Usunąć ten post?'),
  postsDeleteBody: dt(
    'Razem z nim znikną odpowiedzi, polubienia i statystyki. Tego nie da się cofnąć.'
  ),
  postsDeleteConfirm: dt('Usuń post'),
  postsSaved: dt('{mode:enum}', {
    enum: {
      mode: {
        now: 'Post opublikowany',
        draft: 'Szkic zapisany',
        schedule: 'Post zaplanowany',
        edit: 'Zmiany zapisane',
      },
    },
  }),
  postsSaveFailed: dt('Nie udało się zapisać posta.'),
  composerTitleNew: dt('Nowy post'),
  composerTitleEdit: dt('Edytuj post'),
  composerDescription: dt(
    'Wybierz rodzaj posta, napisz go, a potem opublikuj, zaplanuj lub zostaw jako szkic.'
  ),
  composerKinds: dt('Rodzaj posta'),
  composerCount: dt('{count:number} z {max:number}'),
  composerTextLabel: dt('Co chcesz powiedzieć?'),
  composerCaptionLabel: dt('Podpis (opcjonalnie)'),
  composerImagesDrop: dt('Upuść tu do czterech zdjęć albo je wybierz'),
  composerImagesFull: dt('Post może mieć najwyżej cztery zdjęcia.'),
  composerImagesLabel: dt('Zdjęcia, w kolejności widzianej przez widzów'),
  composerImageName: dt('Zdjęcie {position}'),
  composerImageAlt: dt('Tekst alternatywny zdjęcia {position}'),
  composerImageRemove: dt('Usuń zdjęcie {position}'),
  composerImageStatus: dt('{status:enum}', {
    enum: {
      status: { uploading: 'Przesyłanie', ready: 'Gotowe', failed: 'Przesyłanie nie powiodło się' },
    },
  }),
  composerQuestion: dt('Pytanie'),
  composerOptions: dt('Odpowiedzi'),
  composerOption: dt('Odpowiedź {position}'),
  composerOptionAdd: dt('Dodaj odpowiedź'),
  composerOptionRemove: dt('Usuń odpowiedź {position}'),
  composerCorrect: dt('Odpowiedź {position} jest poprawna'),
  composerExplanation: dt('Wyjaśnienie pokazywane po odpowiedzi (opcjonalnie)'),
  composerClosesAt: dt('Głosowanie kończy się (opcjonalnie)'),
  composerClosesHint: dt('W ciągu 30 dni. Bez daty ankieta zostaje otwarta.'),
  composerClosesClear: dt('Zostaw otwartą'),
  composerPollLockedTitle: dt('Głosowanie już trwa'),
  composerPollLockedBody: dt('Pytania i odpowiedzi nie można zmienić, gdy ktoś już zagłosował.'),
  composerVideoLabel: dt('Film'),
  composerPlaylistLabel: dt('Playlista'),
  composerShareNone: dt('Nic jeszcze nie wybrano'),
  composerShareChoose: dt('Wybierz'),
  composerShareChange: dt('Zmień'),
  composerShareSearch: dt('Szukaj po tytule'),
  composerShareEmpty: dt('Nie ma nic publicznego do udostępnienia.'),
  composerShareMore: dt('Wczytaj więcej'),
  composerShareComment: dt('Twój komentarz (opcjonalnie)'),
  composerStartLabel: dt('Czas startu'),
  composerStartSummary: dt('Karta otworzy film od {time}.'),
  composerCommentsEnabled: dt('Pozwól widzom odpowiadać'),
  composerTiming: dt('Kiedy opublikować'),
  composerTimingOption: dt('{mode:enum}', {
    enum: { mode: { now: 'Opublikuj teraz', draft: 'Zapisz jako szkic', schedule: 'Zaplanuj' } },
  }),
  composerPublishAt: dt('Opublikuj o'),
  composerPublishAtHint: dt('Według Twojego czasu lokalnego, w przyszłości.'),
  composerDate: dt('Data'),
  composerTime: dt('Godzina'),
  composerSubmit: dt('{mode:enum}', {
    enum: { mode: { now: 'Opublikuj', draft: 'Zapisz szkic', schedule: 'Zaplanuj' } },
  }),
  composerProblem: dt('{reason:enum}', {
    enum: {
      reason: {
        uploading: 'Poczekaj, aż wszystkie zdjęcia się prześlą.',
        video: 'Wybierz film do udostępnienia.',
        playlist: 'Wybierz playlistę do udostępnienia.',
        date: 'Wybierz datę i godzinę publikacji.',
        past: 'Wybierz moment w przyszłości.',
      },
    },
  }),
  composerSave: dt('Zapisz zmiany'),
  statsTitle: dt('Statystyki posta'),
  statsFigure: dt('{metric:enum}', {
    enum: {
      metric: {
        opens: 'Otwarcia',
        shareClicks: 'Kliknięcia karty',
        likes: 'Polubienia',
        replies: 'Odpowiedzi',
      },
    },
  }),
  statsVotes: dt('Głosy na odpowiedzi'),
  statsOptionVotes: dt('{count:plural}', {
    plural: {
      count: { one: '{?} głos', few: '{?} głosy', many: '{?} głosów', other: '{?} głosu' },
    },
  }),
  statsQuizShare: dt('Poprawnych odpowiedzi:'),
  statsQuizNone: dt('Nikt jeszcze nie odpowiedział.'),
  statsFailed: dt('Nie udało się wczytać statystyk.'),
  commentsTargetChip: dt('{type:enum}', { enum: { type: { video: 'Film', post: 'Post' } } }),
} as const;
