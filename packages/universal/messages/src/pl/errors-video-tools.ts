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
};
