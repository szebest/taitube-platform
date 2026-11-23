import { dt } from '../define';

export const videoToolErrors = {
  revisionNotFound: dt('Ta wersja filmu nie istnieje.'),
  correctionNotFound: dt('Ta korekta nie istnieje.'),
  correctionLimit: dt('Ten film ma już maksymalną liczbę korekt.'),
  shareLinkNotFound: dt('Ten link udostępniania nie istnieje.'),
  shareLinkExpired: dt(
    'Ten link udostępniania wygasł lub został unieważniony. Poproś twórcę o nowy.'
  ),
  shareLinkLimit: dt(
    'Ten film ma już maksymalną liczbę aktywnych linków. Unieważnij jeden, aby dodać kolejny.'
  ),
  videoPasswordRequired: dt('Ten film jest chroniony hasłem.'),
  videoPasswordInvalid: dt('To hasło jest nieprawidłowe.'),
  videoPasswordsOff: dt('Hasła są wyłączone na tym serwerze.'),
  experimentNotFound: dt('Ten test nie istnieje.'),
  experimentLimit: dt('Na tym filmie trwa już test albo kanał prowadzi maksymalną liczbę testów.'),
  experimentNotRunning: dt('Ten test już się zakończył.'),
  generationInProgress: dt(
    'Nowy plik lub edycja tego filmu jest już przetwarzana. Poczekaj, aż się zakończy.'
  ),
  replacementNotUploaded: dt(
    'Nowy plik nie został jeszcze przesłany. Prześlij go i spróbuj ponownie.'
  ),
  noEditToRevert: dt('Ten film nie ma zastosowanej edycji do cofnięcia.'),
};
