import { dt } from '../define';

export const studioComments = {
  commentsNav: dt('Komentarze'),
  commentsNavNew: dt('Nowe komentarze'),
  commentsTitle: dt('Komentarze'),
  commentsFilter: dt('Pokaż'),
  commentsFilterOption: dt('{filter:enum}', {
    enum: {
      filter: {
        all: 'Wszystkie',
        unanswered: 'Bez odpowiedzi',
        reported: 'Zgłoszone',
        held: 'Wstrzymane',
        hidden: 'Ukryte',
        questions: 'Pytania',
        restricted: 'Ograniczeni',
      },
    },
  }),
  commentsCaption: dt('Komentarze pod Twoimi filmami, od najnowszych'),
  commentsVideo: dt('Film'),
  commentsAuthor: dt('Autor'),
  commentsComment: dt('Komentarz'),
  commentsPosted: dt('Dodano'),
  commentsActions: dt('Działania'),
  commentsReply: dt('Odpowiedz'),
  commentsReplyLabel: dt('Twoja odpowiedź'),
  commentsSendReply: dt('Opublikuj odpowiedź'),
  commentsReplied: dt('Odpowiedź opublikowana'),
  commentsReplyFailed: dt('Nie udało się opublikować odpowiedzi.'),
  commentsHeart: dt('Serduszko'),
  commentsHeartFailed: dt('Nie udało się zmienić serduszka.'),
  commentsPin: dt('Przypnij'),
  commentsPinFailed: dt('Nie udało się zmienić przypięcia.'),
  commentsEmptyTitle: dt('Brak komentarzy'),
  commentsEmptyDescription: dt('Tutaj pojawiają się komentarze widzów pod Twoimi filmami.'),
  commentsFailed: dt('Nie udało się wczytać komentarzy.'),
} as const;
