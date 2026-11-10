import { dt } from '../define';

export const commentErrors = {
  commentNotFound: dt('Ten komentarz nie istnieje lub został usunięty.'),
  commentNotPinnable: dt('Przypiąć można tylko komentarz najwyższego poziomu.'),
  commentAlreadyReported: dt('Ten komentarz został już przez Ciebie zgłoszony.'),
  commentsBanned: dt('Nie możesz teraz komentować na tym kanale.'),
  commentsDisabled: dt('Komentarze są wyłączone dla tego filmu.'),
  commentsSubscribersOnly: dt('Na tym kanale mogą komentować tylko subskrybenci.'),
  commentsAccountTooNew: dt('Twoje konto jest jeszcze zbyt nowe, aby komentować na tym kanale.'),
  commentsSlowMode: dt(
    'Tryb spowolnienia jest włączony: odczekaj chwilę przed kolejnym komentarzem.'
  ),
  moderationNotApplicable: dt('Ta akcja nie ma zastosowania do komentarza w jego obecnym stanie.'),
  restrictionNotFound: dt('Ten użytkownik nie ma ograniczeń na kanale.'),
  cannotRestrictMember: dt('Właściciela kanału i jego zespołu nie można ograniczyć.'),
  savedReplyNotFound: dt('Ta zapisana odpowiedź nie istnieje.'),
  savedReplyLimit: dt('Kanał może mieć najwyżej 20 zapisanych odpowiedzi.'),
};
