import { dt } from '@vp/shared-messages';

export const studioSharing = {
  shareLinksTitle: dt('Linki udostępniania'),
  shareLinksDescription: dt(
    'Link udostępniania pozwala każdemu, kto go ma, obejrzeć ten film bez względu na jego widoczność, i nic więcej. Aktywnych może być naraz do 50 linków.'
  ),
  shareLinkLabel: dt('Etykieta'),
  shareLinkLabelHint: dt('Opcjonalna, do {max} znaków. Widzisz ją tylko Ty.'),
  shareLinkLabelTooLong: dt('Użyj etykiety o długości do {max} znaków.'),
  shareLinkExpiry: dt('Wygasa po'),
  shareLinkExpiryOption: dt('{expiry:enum}', {
    enum: {
      expiry: {
        '1h': '1 godzinie',
        '24h': '24 godzinach',
        '7d': '7 dniach',
        '30d': '30 dniach',
        never: 'Nigdy',
      },
    },
  }),
  shareLinkCreate: dt('Utwórz link'),
  shareLinkCreated: dt('Link udostępniania utworzony'),
  shareLinkCreateFailed: dt('Nie udało się utworzyć linku udostępniania.'),
  shareLinksEmpty: dt('Brak linków udostępniania.'),
  shareLinksLoadFailed: dt('Nie udało się wczytać linków udostępniania.'),
  shareLinksTableLabel: dt('Linki udostępniania tego filmu'),
  shareLinksColumnLabel: dt('Etykieta'),
  shareLinksColumnState: dt('Stan'),
  shareLinksColumnExpires: dt('Wygasa'),
  shareLinksColumnOpens: dt('Otwarcia'),
  shareLinksColumnViews: dt('Wyświetlenia'),
  shareLinksColumnWatchTime: dt('Czas oglądania'),
  shareLinksColumnActions: dt('Działania'),
  shareLinkNoLabel: dt('Bez etykiety'),
  shareLinkNeverExpires: dt('Nigdy'),
  shareLinkState: dt('{state:enum}', {
    enum: { state: { active: 'Aktywny', expired: 'Wygasł', revoked: 'Unieważniony' } },
  }),
  shareLinkCopy: dt('Kopiuj link'),
  shareLinkCopyFor: dt('Kopiuj link {label}'),
  shareLinkCopied: dt('link udostępniania'),
  shareLinkRevoke: dt('Unieważnij'),
  shareLinkRevokeFor: dt('Unieważnij link {label}'),
  shareLinkRevoked: dt('Link udostępniania unieważniony'),
  shareLinkRevokeFailed: dt('Nie udało się unieważnić linku udostępniania.'),
  passwordTitle: dt('Hasło'),
  passwordDescription: dt(
    'Widzowie wpisują hasło raz na stronie oglądania lub w osadzeniu i oglądają przez 12 godzin.'
  ),
  passwordSwitch: dt('Chroń hasłem'),
  passwordField: dt('Hasło'),
  passwordHint: dt('Od {min} do {max} znaków. Nie zostanie już pokazane, nawet Tobie.'),
  passwordInvalid: dt('Użyj od {min} do {max} znaków.'),
  passwordUnlistedOnly: dt(
    'Hasło można ustawić tylko dla filmu niepublicznego. Najpierw zmień widoczność na niepubliczny w karcie Szczegóły.'
  ),
  passwordOn: dt('Aby obejrzeć ten film, widzowie potrzebują hasła.'),
  passwordSave: dt('Zapisz hasło'),
  passwordSaved: dt('Hasło zapisane'),
  passwordSaveFailed: dt('Nie udało się zapisać hasła.'),
  passwordRemove: dt('Usuń hasło'),
  passwordRemoved: dt('Hasło usunięte'),
  passwordRemoveFailed: dt('Nie udało się usunąć hasła.'),
  accessGateTitle: dt('Bramka dostępu, nie szyfrowanie'),
  accessGateBody: dt(
    'Linki udostępniania i hasła decydują, kogo strona, odtwarzacz i API przepuszczą. Sam film pozostaje w publicznym magazynie pod adresami, których nikt nie zgadnie, dokładnie jak film niepubliczny.'
  ),
} as const;
